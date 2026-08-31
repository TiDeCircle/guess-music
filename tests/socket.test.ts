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
    expect(playing.round.choices).toHaveLength(4);
    // The answer must not be on the wire before the reveal.
    expect(JSON.stringify(playing.round)).not.toContain("correct");

    const choice = playing.round.choices[0].id;
    host.emit("round:answer", { index: playing.round.index, choiceId: choice });
    guest.emit("round:answer", { index: playing.round.index, choiceId: choice });

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
     * Which choice is the right one, read off the mocked pool.
     *
     * The fixture names each preview after its track id, so a test can tell a
     * wrong option from a right one without waiting for the reveal. Nothing
     * real leaks this way: Apple's preview URLs are opaque hashes with neither
     * the id nor the title in them.
     */
    function wrongChoice(round: any): string {
      const answerId = /\/([\w-]+)\.m4a$/.exec(round.previewUrl)![1];
      const wrong = round.choices.find((c: any) => c.id !== answerId);
      expect(wrong).toBeDefined();
      return wrong.id;
    }

    /** Wait for one `round:strike`, or prove within `ms` that none arrived. */
    function nextStrike(sock: Socket, ms = 1200) {
      return new Promise<any | null>((resolve) => {
        const timer = setTimeout(() => {
          sock.off("round:strike", onStrike);
          resolve(null);
        }, ms);
        const onStrike = (payload: any) => {
          clearTimeout(timer);
          sock.off("round:strike", onStrike);
          resolve(payload);
        };
        sock.on("round:strike", onStrike);
      });
    }

    /** Two clients in one room, playing the given mode, on an open round. */
    async function playing(mode: "heardle" | "heardle-coop") {
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
      return { host, guest, round: open.round };
    }

    it("tells the guesser their option is gone, and tells nobody else", async () => {
      const { host, guest, round } = await playing("heardle");
      const wrong = wrongChoice(round);

      const mine = nextStrike(host);
      const theirs = nextStrike(guest);
      host.emit("round:answer", { index: round.index, choiceId: wrong });

      expect(await mine).toEqual({ index: round.index, choiceId: wrong });
      // Broadcasting it would hand the guest a free elimination.
      expect(await theirs).toBeNull();
    });

    it("keeps the round open after a wrong guess, with the board untouched", async () => {
      const { host, guest, round } = await playing("heardle");
      const wrong = wrongChoice(round);

      const strike = nextStrike(host);
      host.emit("round:answer", { index: round.index, choiceId: wrong });
      await strike;

      const seen = await nextState(guest, (s) => s.phase === "playing");
      expect(seen.round.strikes).toEqual([]);
      expect(seen.answeredPlayerIds).toEqual([]);
    });

    it("shows a co-op strike to the whole room", async () => {
      const { host, guest, round } = await playing("heardle-coop");
      const wrong = wrongChoice(round);

      host.emit("round:answer", { index: round.index, choiceId: wrong });

      // Shared attempts are unplayable unless everyone can see what is gone.
      const seen = await nextState(
        guest,
        (s) => s.phase === "playing" && s.round.strikes.length > 0,
      );
      expect(seen.round.strikes).toEqual([wrong]);
    });

    it("carries the stage ladder to the client", async () => {
      const { round } = await playing("heardle");
      expect(round.stagesMs.length).toBeGreaterThan(1);
      const sorted = [...round.stagesMs].sort((a: number, b: number) => a - b);
      expect(round.stagesMs).toEqual(sorted);
      // The music runs to the last mark, then the silence keeps answers open.
      expect(round.clipMs).toBe(round.stagesMs.at(-1));
      expect(round.answerWindowMs).toBeGreaterThan(round.clipMs);
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
