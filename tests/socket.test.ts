import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { Track } from "@/shared/types";

// The pool normally comes from iTunes. These tests are about the wiring
// between a socket and the room store, so the catalog is a fixed list.
vi.mock("@/server/catalog", () => ({
  EmptyCatalogError: class extends Error {},
  ThinArtistError: class extends Error {},
  buildPool: async (): Promise<Track[]> => {
    const out: Track[] = [];
    for (let a = 0; a < 12; a++) {
      for (let s = 0; s < 6; s++) {
        out.push({
          id: `${a}-${s}`,
          title: `Song ${a}-${s}`,
          artist: `Artist ${a}`,
          artistId: a,
          artworkUrl: "https://example.test/art.jpg",
          previewUrl: `https://example.test/${a}-${s}.m4a`,
          year: 2000 + s,
        });
      }
    }
    return out;
  },
}));

const { attachSocketServer } = await import("@/server/socket");
const { ROOM_TUNING } = await import("@/server/rooms");

/**
 * These tests exist because of a bug they would have caught: the server could
 * send a room back to the lobby, and the room tests proved it worked, but no
 * socket event ever reached that method. The logic was correct and completely
 * unreachable. Anything a player can do has to be exercised through a real
 * socket, not by calling the store directly.
 */
let http: HttpServer;
let url: string;
let stop: () => void;

beforeAll(async () => {
  http = createServer();
  const ioServer = attachSocketServer(http);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  stop = () => {
    ioServer.close();
    http.close();
  };
});

afterAll(() => stop());

const clients: Socket[] = [];

async function client(): Promise<Socket> {
  const socket = connect(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  await new Promise<void>((r) => socket.on("connect", () => r()));
  return socket;
}

afterAll(() => {
  for (const c of clients) c.close();
});

const emit = <T,>(s: Socket, event: string, payload?: unknown): Promise<T> =>
  new Promise((r) => s.emit(event, payload, r));

/** Wait for a room state matching a predicate, so tests never sleep blindly. */
function nextState(s: Socket, match: (state: any) => boolean, ms = 4000) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off("room:state", onState);
      reject(new Error("timed out waiting for room state"));
    }, ms);
    const onState = (state: any) => {
      if (!match(state)) return;
      clearTimeout(timer);
      s.off("room:state", onState);
      resolve(state);
    };
    s.on("room:state", onState);
  });
}

/**
 * Sit out the lead-in, for real.
 *
 * These tests run against a live server on real timers, so the beat between the
 * room going live and the clip starting has to actually elapse — answers are
 * refused until it does. Only the tests that submit an answer pay for it.
 *
 * Waits on the Round's own `startAt` rather than a constant: the first Round of
 * a match is counted in over three seconds and the rest get a short beat, and
 * sleeping the longer one every time would put seconds on this file for
 * nothing. Server and test share a process, so the two clocks are the same one.
 */
const goLive = (round: any) =>
  new Promise((r) => setTimeout(r, Math.max(round.startAt - Date.now(), 0) + 50));

describe("socket wiring", () => {
  it("creates a room and hands back a code, a player and a session", async () => {
    const host = await client();
    const res = await emit<any>(host, "room:create", { name: "Host" });
    expect(res.ok).toBe(true);
    expect(res.data.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(res.data.playerId).toBeTruthy();
    expect(res.data.sessionId).toBeTruthy();
  });

  it("refuses a bad name instead of crashing", async () => {
    const s = await client();
    const res = await emit<any>(s, "room:create", { name: "" });
    expect(res.ok).toBe(false);
  });

  it("refuses to join a room that does not exist", async () => {
    const s = await client();
    const res = await emit<any>(s, "room:join", { code: "ZZZZ", name: "Nobody" });
    expect(res.ok).toBe(false);
  });

  it("answers a clock sync with a server timestamp", async () => {
    const s = await client();
    const before = Date.now();
    const now = await new Promise<number>((r) => s.emit("clock:sync", r));
    expect(now).toBeGreaterThanOrEqual(before - 1000);
    expect(now).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("carries a config change to the other player in the room", async () => {
    const host = await client();
    const guest = await client();
    const created = await emit<any>(host, "room:create", { name: "Host" });
    await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });

    host.emit("room:config", {
      mode: "quiz",
      source: { kind: "playlist", playlist: "kpop-now" },
      difficulty: "hard",
      roundCount: 5,
    });
    const state = await nextState(guest, (s) => s.config.difficulty === "hard");
    expect(state.config.source).toEqual({ kind: "playlist", playlist: "kpop-now" });
    expect(state.config.roundCount).toBe(5);
  });

  it("plays a round through and reveals it to both players", async () => {
    const host = await client();
    const guest = await client();
    const created = await emit<any>(host, "room:create", { name: "Host" });
    await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });

    host.emit("room:config", {
      mode: "quiz",
      source: { kind: "playlist", playlist: "thai-classic" },
      difficulty: "hard",
      roundCount: 3,
    });
    await nextState(host, (s) => s.config.roundCount === 3);

    host.emit("match:start");
    const loading = await nextState(host, (s) => s.phase === "loading" && s.round);
    host.emit("round:ready", { index: loading.round.index });
    guest.emit("round:ready", { index: loading.round.index });

    const playing = await nextState(host, (s) => s.phase === "playing");
    await goLive(playing.round);
    expect(playing.round.choices).toHaveLength(4);
    // The answer must not be on the wire before the reveal.
    expect(JSON.stringify(playing.round)).not.toContain("correct");

    const choice = playing.round.choices[0].id;
    host.emit("round:answer", { index: playing.round.index, guess: choice });
    guest.emit("round:answer", { index: playing.round.index, guess: choice });

    const reveal = await nextState(guest, (s) => s.phase === "reveal");
    expect(reveal.reveal.track.title).toBeTruthy();
    expect(reveal.reveal.results).toHaveLength(2);
  });

  // The regression this file was written for.
  it("takes the room back to the lobby without anyone rejoining", async () => {
    const host = await client();
    const guest = await client();
    const created = await emit<any>(host, "room:create", { name: "Host" });
    await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });

    host.emit("room:config", {
      mode: "quiz",
      source: { kind: "playlist", playlist: "thai-classic" },
      difficulty: "extreme",
      roundCount: 3,
    });
    await nextState(host, (s) => s.config.roundCount === 3);
    host.emit("match:start");
    await nextState(host, (s) => s.phase === "loading");

    host.emit("match:lobby");
    const lobby = await nextState(guest, (s) => s.phase === "lobby");

    // Same room, same players, nothing left of the match.
    expect(lobby.code).toBe(created.data.code);
    expect(lobby.players).toHaveLength(2);
    expect(lobby.round).toBeNull();
    expect(lobby.summary).toBeNull();
    // And the settings survive, so the host is adjusting rather than starting over.
    expect(lobby.config.difficulty).toBe("extreme");
  });

  describe("heardle", () => {
    /**
     * The right answer, read off the mocked pool.
     *
     * The fixture names each preview after its track, so a test can type the
     * correct title without waiting for the reveal. Nothing real leaks this
     * way: Apple's preview URLs are opaque hashes with no title in them.
     */
    function answerTitle(round: any): string {
      const id = /\/([\w-]+)\.m4a$/.exec(round.previewUrl)![1];
      return `Song ${id}`;
    }

    const WRONG = "A Song That Is Not Playing";

    /** Send a guess and wait for the server's private verdict. */
    const guess = (sock: Socket, index: number, text: string) =>
      new Promise<any>((r) => sock.emit("round:answer", { index, guess: text }, r));

    /** Two clients in one room, playing the given mode, on an open round. */
    // `waitOut` is false only for the tests that inspect what came over the
    // wire without ever answering, which would otherwise pay the lead-in for
    // nothing.
    async function playing(mode: "heardle" | "heardle-coop", waitOut = true) {
      const host = await client();
      const guest = await client();
      const created = await emit<any>(host, "room:create", { name: "Host" });
      await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });

      host.emit("room:config", {
        mode,
        source: { kind: "playlist", playlist: "thai-classic" },
        difficulty: "medium",
        roundCount: 3,
      });
      await nextState(host, (s) => s.config.mode === mode);

      host.emit("match:start");
      const loading = await nextState(host, (s) => s.phase === "loading" && s.round);
      host.emit("round:ready", { index: loading.round.index });
      guest.emit("round:ready", { index: loading.round.index });
      const open = await nextState(host, (s) => s.phase === "playing");
      if (waitOut) await goLive(open.round);
      return { host, guest, round: open.round };
    }

    it("puts no options on the wire at all", async () => {
      const { round } = await playing("heardle", false);
      expect(round.choices).toEqual([]);
      // Not the title, not the id — there is nothing to recognise.
      expect(JSON.stringify(round)).not.toContain(answerTitle(round));
      expect(round.stagesMs.length).toBeGreaterThan(1);
    });

    it("tells the guesser their answer was wrong, and tells nobody else", async () => {
      const { host, guest, round } = await playing("heardle");

      const verdict = await guess(host, round.index, WRONG);
      expect(verdict).toEqual({
        ok: true,
        data: { correct: false, final: false, level: 1 },
      });

      // The room snapshot reaches everyone, so it must not carry the verdict —
      // only that the host has spent a level, which is not a hint about the song.
      const seen = await nextState(guest, (s) => s.phase === "playing");
      expect(seen.answeredPlayerIds).toEqual([]);
      expect(JSON.stringify(seen)).not.toContain(WRONG);
    });

    it("accepts the typed title and closes the round", async () => {
      const { host, guest, round } = await playing("heardle");
      const title = answerTitle(round);

      const mine = await guess(host, round.index, title);
      expect(mine.data.correct).toBe(true);
      expect(mine.data.final).toBe(true);

      // Listen before guessing: the server broadcasts the reveal from inside
      // the same call it later acks, so the state can land first.
      const revealed = nextState(guest, (s) => s.phase === "reveal");
      await guess(guest, round.index, title);
      const reveal = await revealed;
      expect(reveal.reveal.track.title).toBe(title);
    });

    it("carries an unlock to the whole room's view of the ladder", async () => {
      const { host, guest, round } = await playing("heardle");
      const hostId = round.levels[0].playerId;

      host.emit("round:unlock", { index: round.index });
      const seen = await nextState(
        guest,
        (s) => s.round?.levels.some((l: any) => l.level > 0),
      );

      // Everyone can see how much music a rival has spent — that is not a hint
      // about the song, and watching it is half the fun.
      const levels = new Map(seen.round.levels.map((l: any) => [l.playerId, l.level]));
      expect([...levels.values()].filter((v) => v === 1)).toHaveLength(1);
      expect(levels.size).toBe(2);
      expect(hostId).toBeTruthy();
    });

    it("moves the whole room up one rung in co-op", async () => {
      const { host, guest, round } = await playing("heardle-coop");

      host.emit("round:unlock", { index: round.index });
      const seen = await nextState(
        guest,
        (s) => s.round?.levels.every((l: any) => l.level === 1),
      );
      expect(seen.round.levels).toHaveLength(2);
    });

    it("scores everyone in co-op off one typed answer", async () => {
      const { host, guest, round } = await playing("heardle-coop");

      const revealed = nextState(guest, (s) => s.phase === "reveal");
      await guess(host, round.index, answerTitle(round));
      const reveal = await revealed;

      const scores = reveal.players.map((p: any) => p.score);
      expect(scores[0]).toBeGreaterThan(0);
      expect(new Set(scores).size).toBe(1);
    });
  });

  describe("room browser", () => {
    /** Wait for a listing that satisfies a predicate. */
    function nextListing(s: Socket, match: (rooms: any[]) => boolean, ms = 4000) {
      return new Promise<any[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          s.off("rooms:listing", onList);
          reject(new Error("timed out waiting for listing"));
        }, ms);
        const onList = (rooms: any[]) => {
          if (!match(rooms)) return;
          clearTimeout(timer);
          s.off("rooms:listing", onList);
          resolve(rooms);
        };
        s.on("rooms:listing", onList);
      });
    }

    it("answers a watcher immediately rather than leaving them blank", async () => {
      const watcher = await client();
      const first = new Promise<any[]>((r) => watcher.once("rooms:listing", r));
      watcher.emit("rooms:watch");
      expect(Array.isArray(await first)).toBe(true);
    });

    it("shows a new room to someone watching, without names", async () => {
      const watcher = await client();
      watcher.emit("rooms:watch");
      const host = await client();
      const created = await emit<any>(host, "room:create", { name: "SecretName" });

      const rooms = await nextListing(watcher, (rs) =>
        rs.some((r) => r.code === created.data.code),
      );
      const mine = rooms.find((r) => r.code === created.data.code);
      expect(mine.playerCount).toBe(1);
      expect(mine.phase).toBe("lobby");
      // The site is public; a listing is not the place for who is in the room.
      expect(JSON.stringify(mine)).not.toContain("SecretName");
    });

    it("takes a locked room off the list but still lets a code in", async () => {
      const watcher = await client();
      watcher.emit("rooms:watch");
      const host = await client();
      const created = await emit<any>(host, "room:create", { name: "Host" });
      await nextListing(watcher, (rs) => rs.some((r) => r.code === created.data.code));

      host.emit("room:lock", { locked: true });
      await nextListing(watcher, (rs) => !rs.some((r) => r.code === created.data.code));

      // Unlisted, not sealed: whoever was already given the code still gets in.
      const guest = await client();
      const joined = await emit<any>(guest, "room:join", {
        code: created.data.code,
        name: "Guest",
      });
      expect(joined.ok).toBe(true);
    });

    it("puts an unlocked room back on the list", async () => {
      const watcher = await client();
      watcher.emit("rooms:watch");
      const host = await client();
      const created = await emit<any>(host, "room:create", { name: "Host" });
      host.emit("room:lock", { locked: true });
      await nextListing(watcher, (rs) => !rs.some((r) => r.code === created.data.code));
      host.emit("room:lock", { locked: false });
      await nextListing(watcher, (rs) => rs.some((r) => r.code === created.data.code));
    });

    it("only lets the host lock the room", async () => {
      const host = await client();
      const guest = await client();
      const created = await emit<any>(host, "room:create", { name: "Host" });
      await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });
      const refused = new Promise<any>((r) => guest.once("room:error", r));
      guest.emit("room:lock", { locked: true });
      expect((await refused).message).toMatch(/host/);
    });

    it("stops pushing the list once a watcher stops watching", async () => {
      const watcher = await client();
      watcher.emit("rooms:watch");
      await new Promise<any[]>((r) => watcher.once("rooms:listing", r));
      watcher.emit("rooms:unwatch");
      await new Promise((r) => setTimeout(r, 100));

      let pushed = false;
      watcher.on("rooms:listing", () => (pushed = true));
      const host = await client();
      await emit<any>(host, "room:create", { name: "Host" });
      await new Promise((r) => setTimeout(r, 500));
      expect(pushed).toBe(false);
    });
  });

  it("ignores a lobby request from someone who is not the host", async () => {
    const host = await client();
    const guest = await client();
    const created = await emit<any>(host, "room:create", { name: "Host" });
    await emit<any>(guest, "room:join", { code: created.data.code, name: "Guest" });
    host.emit("match:start");
    await nextState(host, (s) => s.phase === "loading");

    const refused = new Promise<any>((r) => guest.once("room:error", r));
    guest.emit("match:lobby");
    expect((await refused).message).toMatch(/host/);
  });
});
