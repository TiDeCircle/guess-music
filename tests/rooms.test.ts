import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";

// The pool normally comes from iTunes over the network. These tests are about
// the Lockstep sequence, so the catalog is replaced with a fixed pool.
vi.mock("@/server/catalog", () => ({
  EmptyCatalogError: class extends Error {},
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

const { RoomStore, ROOM_TUNING, toRoomState } = await import("@/server/rooms");

type Store = InstanceType<typeof RoomStore>;

let store: Store;
let states: number;

beforeEach(() => {
  vi.useFakeTimers();
  states = 0;
  store = new RoomStore({
    onState: () => {
      states++;
    },
    onClosed: () => {},
    onListingChanged: () => {},
  });
});

afterEach(() => {
  store.stop();
  vi.useRealTimers();
});

/** Create a room with `n` players; returns the room and every player id. */
function seed(n: number) {
  const { room, player } = store.createRoom("P0", "sock-0");
  const ids = [player.id];
  for (let i = 1; i < n; i++) {
    ids.push(store.joinRoom(room.code, `P${i}`, `sock-${i}`).player.id);
  }
  return { room, ids };
}

async function startMedium(room: ReturnType<typeof seed>["room"], hostId: string) {
  store.setConfig(room, hostId, {
    mode: "quiz",
    source: { kind: "playlist", playlist: "thai-classic" },
    difficulty: "medium",
    roundCount: 3,
  });
  await store.startMatch(room, hostId);
}

/**
 * Sit through the lead-in, however long this Round's happens to be.
 *
 * The clock starts a beat after the last client buffers, so everyone gets the
 * same moment to look up before the clip — three seconds to count the Match in
 * on the first Round, a short beat on the rest. Answers are refused until it
 * passes, which is why almost every test that submits one waits here first.
 *
 * Measured off `startAt` rather than the constants, so a test never advances
 * past the start and quietly spends part of the answer window it is checking.
 */
function goLive(room: ReturnType<typeof seed>["room"]) {
  vi.advanceTimersByTime(Math.max(room.match!.startAt - Date.now(), 0));
}

describe("room lifecycle", () => {
  it("gives every room a distinct four-letter code", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(store.createRoom("P", `s${i}`).room.code);
    }
    expect(codes.size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{4}$/);
  });

  it("refuses a ninth player", () => {
    const { room } = seed(8);
    expect(() => store.joinRoom(room.code, "P8", "sock-8")).toThrow(/เต็ม/);
  });

  it("hands the host role to someone still connected when the host drops", () => {
    const { room, ids } = seed(3);
    expect(room.hostId).toBe(ids[0]);
    store.disconnect("sock-0");
    expect(room.hostId).not.toBe(ids[0]);
    expect(room.players.get(room.hostId)?.connected).toBe(true);
  });

  it("accepts an artist as the song source", () => {
    const { room, ids } = seed(1);
    store.setConfig(room, ids[0]!, {
      mode: "quiz",
      source: { kind: "artist", artist: "Bodyslam" },
      difficulty: "hard",
      roundCount: 5,
    });
    expect(toRoomState(room).config.source).toEqual({
      kind: "artist",
      artist: "Bodyslam",
    });
  });

  // The picker never offers this pairing, but a socket payload is not the
  // picker — and a match started on it would have no rounds to play.
  it("refuses a mode and source that cannot play together", () => {
    const { room, ids } = seed(1);
    expect(() =>
      store.setConfig(room, ids[0]!, {
        mode: "anime",
        source: { kind: "playlist", playlist: "thai-classic" },
        difficulty: "medium",
        roundCount: 5,
      }),
    ).toThrow(/เล่นกับ/);
  });

  it("only lets the host change the config", () => {
    const { room, ids } = seed(2);
    expect(() =>
      store.setConfig(room, ids[1]!, {
        mode: "quiz",
        source: { kind: "playlist", playlist: "kpop-classic" },
        difficulty: "hard",
        roundCount: 5,
      }),
    ).toThrow(/host/);
  });

  it("returns a dropped player to their own seat and score", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    const sessionId = room.players.get(ids[1]!)!.sessionId;

    store.disconnect("sock-1");
    expect(room.players.get(ids[1]!)!.connected).toBe(false);

    const back = store.joinRoom(room.code, "P1", "sock-1b", sessionId);
    expect(back.player.id).toBe(ids[1]);
    expect(back.player.connected).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it("frees the seat once the grace period has passed", () => {
    const { room, ids } = seed(2);
    store.start();
    store.disconnect("sock-1");
    vi.advanceTimersByTime(ROOM_TUNING.RECONNECT_GRACE_MS + 20_000);
    expect(room.players.has(ids[1]!)).toBe(false);
  });
});

describe("moderation", () => {
  it("removes a kicked player and reports who was removed", () => {
    const { room, ids } = seed(2);
    const removed = store.kick(room, ids[0]!, ids[1]!);
    expect(removed?.id).toBe(ids[1]);
    expect(room.players.has(ids[1]!)).toBe(false);
  });

  it("blocks a kicked player's session from rejoining, even by code", () => {
    const { room, ids } = seed(2);
    const sessionId = room.players.get(ids[1]!)!.sessionId;
    store.kick(room, ids[0]!, ids[1]!);
    expect(() => store.joinRoom(room.code, "P1", "sock-1b", sessionId)).toThrow();
  });

  it("only lets the host kick", () => {
    const { room, ids } = seed(2);
    expect(() => store.kick(room, ids[1]!, ids[0]!)).toThrow(/host/);
    expect(room.players.has(ids[0]!)).toBe(true);
  });

  it("refuses the host kicking themselves", () => {
    const { room, ids } = seed(2);
    expect(() => store.kick(room, ids[0]!, ids[0]!)).toThrow();
    expect(room.players.has(ids[0]!)).toBe(true);
  });

  it("mutes one player's reactions without touching anyone else's", () => {
    const seenPlayers: string[] = [];
    store = new RoomStore({
      onState: () => {},
      onClosed: () => {},
      onListingChanged: () => {},
      onReaction: (_room, playerId) => seenPlayers.push(playerId),
    });
    const { room, ids } = seed(2);
    store.setMuted(room, ids[0]!, ids[1]!, true);

    store.recordReaction(room, ids[1]!, "fire");
    store.recordReaction(room, ids[0]!, "gg");

    expect(seenPlayers).toEqual([ids[0]]);
  });

  it("stops muting once toggled back off", () => {
    const seenPlayers: string[] = [];
    store = new RoomStore({
      onState: () => {},
      onClosed: () => {},
      onListingChanged: () => {},
      onReaction: (_room, playerId) => seenPlayers.push(playerId),
    });
    const { room, ids } = seed(2);
    store.setMuted(room, ids[0]!, ids[1]!, true);
    store.setMuted(room, ids[0]!, ids[1]!, false);

    store.recordReaction(room, ids[1]!, "fire");
    expect(seenPlayers).toEqual([ids[1]]);
  });

  it("only lets the host mute", () => {
    const { room, ids } = seed(2);
    expect(() => store.setMuted(room, ids[1]!, ids[0]!, true)).toThrow(/host/);
  });

  it("refuses the host muting themselves", () => {
    const { room, ids } = seed(2);
    expect(() => store.setMuted(room, ids[0]!, ids[0]!, true)).toThrow();
  });

  it("reports muted status on the player list", () => {
    const { room, ids } = seed(2);
    store.setMuted(room, ids[0]!, ids[1]!, true);
    const state = toRoomState(room);
    expect(state.players.find((p) => p.id === ids[1])!.muted).toBe(true);
    expect(state.players.find((p) => p.id === ids[0])!.muted).toBe(false);
  });
});

describe("lockstep sequence", () => {
  it("does not start the clock until every client has its audio", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);

    expect(room.phase).toBe("loading");
    expect(room.match!.deadlineAt).toBe(0);

    store.markReady(room, ids[0]!, 0);
    expect(room.phase).toBe("loading");

    store.markReady(room, ids[1]!, 0);
    expect(room.phase).toBe("playing");
    expect(room.match!.deadlineAt).toBeGreaterThan(room.match!.startAt);
  });

  it("starts anyway when a client never reports ready", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);

    vi.advanceTimersByTime(ROOM_TUNING.AUDIO_READY_TIMEOUT_MS + 100);
    expect(room.phase).toBe("playing");
  });

  it("keeps every player on the same round", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);
    goLive(room);

    // One player answers; the round must not advance for anyone.
    const correct = room.match!.rounds[0]!.answer.id;
    store.submitAnswer(room, ids[0]!, 0, correct);
    expect(room.phase).toBe("playing");
    expect(toRoomState(room).round!.index).toBe(0);

    store.submitAnswer(room, ids[1]!, 0, correct);
    expect(room.phase).toBe("reveal");
  });

  it("closes the round on the deadline when someone never answers", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);
    goLive(room);

    vi.advanceTimersByTime(room.match!.rounds[0]!.answerWindowMs + 50);
    expect(room.phase).toBe("reveal");
    expect(room.reveal!.results.find((r) => r.playerId === ids[1])!.choiceId).toBeNull();
  });

  it("pays more for a faster correct answer", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);
    goLive(room);
    const correct = room.match!.rounds[0]!.answer.id;

    vi.advanceTimersByTime(2_000);
    store.submitAnswer(room, ids[0]!, 0, correct);
    vi.advanceTimersByTime(6_000);
    store.submitAnswer(room, ids[1]!, 0, correct);

    const fast = room.players.get(ids[0]!)!.score;
    const slow = room.players.get(ids[1]!)!.score;
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(0);
  });

  it("ignores a second answer from the same player", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);
    const plan = room.match!.rounds[0]!;
    const wrong = plan.choices.find((c) => c.id !== plan.answer.id)!.id;

    store.submitAnswer(room, ids[0]!, 0, wrong);
    const afterFirst = room.players.get(ids[0]!)!.score;
    store.submitAnswer(room, ids[0]!, 0, plan.answer.id);
    expect(room.players.get(ids[0]!)!.score).toBe(afterFirst);
  });

  it("ignores an answer aimed at a round that is not open", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 5, room.match!.rounds[0]!.answer.id);
    expect(room.players.get(ids[0]!)!.score).toBe(0);
  });

  it("ignores a choice id that is not on the board", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 0, "not-a-choice");
    expect(room.players.get(ids[0]!)!.score).toBe(0);
    expect(room.phase).toBe("playing");
  });

  it("plays every round and then finishes", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);

    for (let i = 0; i < 3; i++) {
      expect(room.phase).toBe("loading");
      store.markReady(room, ids[0]!, i);
      goLive(room);
      expect(room.phase).toBe("playing");
      store.submitAnswer(room, ids[0]!, i, room.match!.rounds[i]!.answer.id);
      expect(room.phase).toBe("reveal");
      vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
    }
    expect(room.phase).toBe("finished");
  });

  it("pays a growing bonus for consecutive correct answers", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);

    const gains: number[] = [];
    for (let i = 0; i < 3; i++) {
      store.markReady(room, ids[0]!, i);
      goLive(room);
      store.submitAnswer(room, ids[0]!, i, room.match!.rounds[i]!.answer.id);
      gains.push(room.reveal!.results[0]!.gained);
      if (i < 2) vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
    }

    // Same near-instant answer every round, so any growth is the streak
    // bonus alone, not the speed bonus.
    expect(gains[1]).toBeGreaterThan(gains[0]!);
    expect(gains[2]).toBeGreaterThan(gains[1]!);
  });

  it("resets the streak bonus on a wrong answer", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);

    store.markReady(room, ids[0]!, 0);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    const firstGain = room.reveal!.results[0]!.gained;
    vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);

    store.markReady(room, ids[0]!, 1);
    goLive(room);
    const wrong = room.match!.rounds[1]!.choices.find(
      (c) => c.id !== room.match!.rounds[1]!.answer.id,
    )!.id;
    store.submitAnswer(room, ids[0]!, 1, wrong);
    vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);

    store.markReady(room, ids[0]!, 2);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 2, room.match!.rounds[2]!.answer.id);
    const afterMiss = room.reveal!.results[0]!.gained;

    // Back to a bare streak of zero, so this pays the same as the very first
    // correct answer rather than continuing to climb.
    expect(afterMiss).toBe(firstGain);
  });

  it("does not stall when the only player still connected has answered", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);
    goLive(room);

    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    expect(room.phase).toBe("playing");
    // The other player leaves without answering: the room must move on.
    store.disconnect("sock-1");
    expect(room.phase).toBe("reveal");
  });

  it("hides the answer from what clients receive", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);

    const state = toRoomState(room);
    const serialised = JSON.stringify(state.round);
    expect(state.reveal).toBeNull();
    expect(serialised).not.toContain("correct");
    // The four choices are all that identify the songs; nothing marks which is
    // the answer.
    expect(state.round!.choices).toHaveLength(4);
  });

  it("tells the client the round's shape before the clock starts", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    // Still in `loading`: no deadline yet, but the client must be able to draw
    // the timer, so the clip and window lengths have to be there already.
    const state = toRoomState(room);
    expect(state.phase).toBe("loading");
    expect(state.round!.deadlineAt).toBe(0);
    expect(state.round!.clipMs).toBeGreaterThan(0);
    expect(state.round!.answerWindowMs).toBeGreaterThanOrEqual(state.round!.clipMs);
  });

  it("resets scores when a new match starts", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    expect(room.players.get(ids[0]!)!.score).toBeGreaterThan(0);

    vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
    store.returnToLobby(room, ids[0]!);
    await startMedium(room, ids[0]!);
    expect(room.players.get(ids[0]!)!.score).toBe(0);
  });

  it("picks different songs for a second match in the same room", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    const first = room.match!.rounds.map((r) => r.answer.id);

    store.returnToLobby(room, ids[0]!);
    await startMedium(room, ids[0]!);
    const second = room.match!.rounds.map((r) => r.answer.id);

    expect(second.some((id) => first.includes(id))).toBe(false);
  });

  describe("match summary", () => {
    it("is withheld until the match is over", async () => {
      const { room, ids } = seed(1);
      await startMedium(room, ids[0]!);
      store.markReady(room, ids[0]!, 0);
      goLive(room);
      // Mid-match it exists on the server but must not be broadcast: it grows
      // every round and every state change goes to every player.
      expect(toRoomState(room).summary).toBeNull();
      store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
      expect(toRoomState(room).summary).toBeNull();
    });

    it("lists every song played, in order, once the match ends", async () => {
      const { room, ids } = seed(2);
      await startMedium(room, ids[0]!);

      const answers: string[] = [];
      for (let i = 0; i < 3; i++) {
        store.markReady(room, ids[0]!, i);
        store.markReady(room, ids[1]!, i);
        goLive(room);
        const plan = room.match!.rounds[i]!;
        answers.push(plan.answer.id);
        // One right, one wrong, so both outcomes land in the summary.
        store.submitAnswer(room, ids[0]!, i, plan.answer.id);
        store.submitAnswer(
          room,
          ids[1]!,
          i,
          plan.choices.find((c) => c.id !== plan.answer.id)!.id,
        );
        vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
      }

      const summary = toRoomState(room).summary;
      expect(summary).not.toBeNull();
      expect(summary!.rounds.map((r) => r.index)).toEqual([0, 1, 2]);
      expect(summary!.rounds.map((r) => r.track.id)).toEqual(answers);

      const first = summary!.rounds[0]!;
      expect(first.track.previewUrl).toBeTruthy();
      expect(first.track.artworkUrl).toBeTruthy();
      expect(first.results.find((r) => r.playerId === ids[0])!.correct).toBe(true);
      expect(first.results.find((r) => r.playerId === ids[0])!.gained).toBeGreaterThan(0);
      expect(first.results.find((r) => r.playerId === ids[1])!.correct).toBe(false);
    });

    it("clears when the room goes back to the lobby", async () => {
      const { room, ids } = seed(1);
      await startMedium(room, ids[0]!);
      store.markReady(room, ids[0]!, 0);
      goLive(room);
      store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
      vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
      expect(room.summary!.rounds.length).toBeGreaterThan(0);

      store.returnToLobby(room, ids[0]!);
      expect(room.summary).toBeNull();
    });

    it("starts a fresh list for a second match", async () => {
      const { room, ids } = seed(1);
      await startMedium(room, ids[0]!);
      for (let i = 0; i < 3; i++) {
        store.markReady(room, ids[0]!, i);
        goLive(room);
        store.submitAnswer(room, ids[0]!, i, room.match!.rounds[i]!.answer.id);
        vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
      }
      expect(room.summary!.rounds).toHaveLength(3);

      store.returnToLobby(room, ids[0]!);
      await startMedium(room, ids[0]!);
      expect(room.summary!.rounds).toHaveLength(0);
    });
  });

  it("broadcasts state on every transition", async () => {
    const { room, ids } = seed(1);
    const before = states;
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    goLive(room);
    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    expect(states).toBeGreaterThan(before + 2);
  });
});

/**
 * Heardle changes two things the Quiz rounds above were written under: a round
 * survives a wrong answer, and in the co-op variant one player's guess moves
 * everyone's score. Both are exercised through the store rather than only
 * through the mode's own pure functions.
 */
async function startHeardle(
  room: ReturnType<typeof seed>["room"],
  hostId: string,
  mode: "heardle" | "heardle-coop",
) {
  store.setConfig(room, hostId, {
    mode,
    source: { kind: "playlist", playlist: "thai-classic" },
    difficulty: "medium",
    roundCount: 3,
  });
  await store.startMatch(room, hostId);
  for (const player of room.players.values()) store.markReady(room, player.id, 0);
  goLive(room);
}

const answerOf = (room: ReturnType<typeof seed>["room"]) =>
  room.match!.rounds[room.match!.index]!.answer.title;

const WRONG = "A Song That Is Not Playing";

/** This player's unlock level as the clients see it. */
const levelOf = (room: ReturnType<typeof seed>["room"], playerId: string) =>
  toRoomState(room).round!.levels.find((l) => l.playerId === playerId)!.level;

describe("heardle rounds", () => {
  it("sends the client no options to recognise", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");
    expect(toRoomState(room).round!.choices).toEqual([]);
    expect(JSON.stringify(toRoomState(room))).not.toContain(answerOf(room));
  });

  it("accepts a typed title and pays the level it was guessed at", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");

    const out = store.submitAnswer(room, ids[0]!, 0, answerOf(room));
    expect(out).toEqual({ correct: true, final: true, level: 0 });
    expect(room.players.get(ids[0]!)!.score).toBeGreaterThan(0);
  });

  it("keeps the round open after a wrong guess, one level down", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");

    const out = store.submitAnswer(room, ids[0]!, 0, WRONG);
    expect(out).toEqual({ correct: false, final: false, level: 1 });
    expect(room.phase).toBe("playing");
    expect(toRoomState(room).answeredPlayerIds).not.toContain(ids[0]);
    expect(levelOf(room, ids[0]!)).toBe(1);
  });

  it("pays less for the same answer after a level is spent", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");
    const title = answerOf(room);

    store.unlock(room, ids[0]!, 0);
    store.submitAnswer(room, ids[0]!, 0, title);
    store.submitAnswer(room, ids[1]!, 0, title);

    expect(room.players.get(ids[0]!)!.score).toBeLessThan(
      room.players.get(ids[1]!)!.score,
    );
  });

  it("ends the round for a player who runs off the top of the ladder", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");
    const ladder = room.match!.rounds[0]!.stagesMs.length;

    let last = null;
    for (let i = 0; i < ladder; i++) {
      last = store.submitAnswer(room, ids[0]!, 0, `${WRONG} ${i}`);
    }
    expect(last!.final).toBe(true);
    expect(toRoomState(room).answeredPlayerIds).toContain(ids[0]);

    // And the right answer no longer helps them.
    store.submitAnswer(room, ids[0]!, 0, answerOf(room));
    expect(room.players.get(ids[0]!)!.score).toBe(0);
  });

  it("keeps one player's tried titles to themselves", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");

    store.submitAnswer(room, ids[0]!, 0, WRONG);
    // Telling the room would hand everyone else a free elimination.
    expect(toRoomState(room).round!.tried).toEqual([]);
  });

  it("refuses a title already tried, without spending a rung", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");

    store.submitAnswer(room, ids[0]!, 0, WRONG);
    expect(store.submitAnswer(room, ids[0]!, 0, WRONG)).toBeNull();
    expect(levelOf(room, ids[0]!)).toBe(1);
  });

  it("keeps one player's ladder off another's", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");

    store.unlock(room, ids[0]!, 0);
    store.unlock(room, ids[0]!, 0);
    expect(levelOf(room, ids[0]!)).toBe(2);
    expect(levelOf(room, ids[1]!)).toBe(0);
  });

  it("stops unlocking at the top of the ladder", async () => {
    const { room, ids } = seed(1);
    await startHeardle(room, ids[0]!, "heardle");
    const last = room.match!.rounds[0]!.stagesMs.length - 1;

    for (let i = 0; i < 10; i++) store.unlock(room, ids[0]!, 0);
    expect(levelOf(room, ids[0]!)).toBe(last);
  });

  it("ignores an unlock aimed at a round that is not open", async () => {
    const { room, ids } = seed(1);
    await startHeardle(room, ids[0]!, "heardle");
    store.unlock(room, ids[0]!, 5);
    expect(levelOf(room, ids[0]!)).toBe(0);
  });

  it("starts every round back at the first level", async () => {
    const { room, ids } = seed(1);
    await startHeardle(room, ids[0]!, "heardle");
    store.unlock(room, ids[0]!, 0);
    store.submitAnswer(room, ids[0]!, 0, answerOf(room));

    vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 100);
    store.markReady(room, ids[0]!, 1);
    goLive(room);
    expect(room.match!.index).toBe(1);
    expect(levelOf(room, ids[0]!)).toBe(0);
  });
});

describe("heardle co-op", () => {
  it("scores the whole room off one player's guess", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");

    store.submitAnswer(room, ids[0]!, 0, answerOf(room));

    const scores = ids.map((id) => room.players.get(id)!.score);
    expect(scores[0]).toBeGreaterThan(0);
    expect(new Set(scores).size).toBe(1);
    expect(room.phase).toBe("reveal");
  });

  it("spends one shared ladder, whoever climbs it", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");

    store.unlock(room, ids[0]!, 0);
    // One player's wrong guess costs the room its next level too.
    store.submitAnswer(room, ids[1]!, 0, WRONG);

    for (const id of ids) expect(levelOf(room, id)).toBe(2);
  });

  it("shows the room which titles it has already burnt", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");

    store.submitAnswer(room, ids[0]!, 0, WRONG);
    // A shared ladder is unplayable unless everyone can see what is spent.
    expect(toRoomState(room).round!.tried).toEqual([WRONG]);

    // And a teammate repeating it costs the room nothing.
    expect(store.submitAnswer(room, ids[1]!, 0, WRONG)).toBeNull();
    for (const id of ids) expect(levelOf(room, id)).toBe(1);
  });

  it("ends the round for everyone when the room runs out of ladder", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");
    const ladder = room.match!.rounds[0]!.stagesMs.length;

    // Guesses from different people, all spending the same shared ladder.
    for (let i = 0; i < ladder; i++) store.submitAnswer(room, ids[i % 3]!, 0, `${WRONG} ${i}`);

    expect(room.phase).toBe("reveal");
    for (const id of ids) expect(room.players.get(id)!.score).toBe(0);
  });

  it("does not wait on someone who joined after the round opened", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle-coop");
    store.joinRoom(room.code, "Latecomer", "sock-late");

    store.submitAnswer(room, ids[0]!, 0, answerOf(room));
    expect(room.phase).toBe("reveal");
  });
});

/**
 * What the reveal has to say beyond who was right.
 *
 * These exist because the round is over but the argument is not: the first
 * thing a room asks is who got it faster, and in co-op, whose guess it actually
 * was — one person answers and everybody is scored for it.
 */
/**
 * Opens a Quiz round and gets past the count-in.
 *
 * Answers are refused until the music actually starts, so a test that submits
 * during the lead-in records nothing and the round never closes.
 */
async function openQuizRound(room: ReturnType<typeof seed>["room"], ids: string[]) {
  await startMedium(room, ids[0]!);
  for (const id of ids) store.markReady(room, id, 0);
  goLive(room);
}

describe("what the reveal reports", () => {
  it("times each answer from the round opening", async () => {
    const { room, ids } = seed(2);
    await openQuizRound(room, ids);
    const correct = room.match!.rounds[0]!.answer.id;

    vi.advanceTimersByTime(1_500);
    store.submitAnswer(room, ids[0]!, 0, correct);
    vi.advanceTimersByTime(3_000);
    store.submitAnswer(room, ids[1]!, 0, correct);

    const at = (id: string) =>
      room.reveal!.results.find((r) => r.playerId === id)!.elapsedMs!;
    expect(at(ids[0]!)).toBeGreaterThanOrEqual(1_500);
    expect(at(ids[1]!)).toBeGreaterThanOrEqual(4_500);
    // And the one who was quicker is visibly quicker, not merely higher-scoring.
    expect(at(ids[0]!)).toBeLessThan(at(ids[1]!));
  });

  it("leaves the time empty for a player who never answered", async () => {
    const { room, ids } = seed(2);
    await openQuizRound(room, ids);

    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    vi.advanceTimersByTime(room.match!.rounds[0]!.answerWindowMs + 50);

    const quiet = room.reveal!.results.find((r) => r.playerId === ids[1])!;
    expect(quiet.elapsedMs).toBeNull();
    expect(quiet.choiceId).toBeNull();
    expect(quiet.byPlayerId).toBeNull();
  });

  it("names whoever actually guessed", async () => {
    const { room, ids } = seed(2);
    await openQuizRound(room, ids);
    const plan = room.match!.rounds[0]!;

    store.submitAnswer(room, ids[0]!, 0, plan.answer.id);
    store.submitAnswer(room, ids[1]!, 0, plan.answer.id);

    for (const id of ids) {
      const row = room.reveal!.results.find((r) => r.playerId === id)!;
      expect(row.byPlayerId).toBe(id);
    }
  });

  it("records the level a heardle answer was bought at", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");
    const title = answerOf(room);

    store.unlock(room, ids[0]!, 0);
    store.unlock(room, ids[0]!, 0);
    store.submitAnswer(room, ids[0]!, 0, title);
    store.submitAnswer(room, ids[1]!, 0, title);

    const at = (id: string) =>
      room.reveal!.results.find((r) => r.playerId === id)!.level;
    expect(at(ids[0]!)).toBe(2);
    expect(at(ids[1]!)).toBe(0);
  });

  it("credits one co-op guess to the player who made it, not to everyone", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");

    // The second player answers; the whole room is scored for it.
    store.submitAnswer(room, ids[1]!, 0, answerOf(room));

    const rows = room.reveal!.results;
    expect(rows).toHaveLength(3);
    // Every row carries the same result...
    expect(new Set(rows.map((r) => r.gained)).size).toBe(1);
    // ...and every row says who it belonged to.
    for (const row of rows) expect(row.byPlayerId).toBe(ids[1]);
  });

  it("keeps the typed title on the row, so the reveal can show it", async () => {
    const { room, ids } = seed(2);
    await startHeardle(room, ids[0]!, "heardle");
    const guess = "Something That Is Not It";

    store.submitAnswer(room, ids[0]!, 0, guess);
    vi.advanceTimersByTime(room.match!.rounds[0]!.answerWindowMs + 50);

    // No final answer was ever recorded — the round timed out on them — but
    // the reveal still has to be able to say what they put.
    const row = room.reveal!.results.find((r) => r.playerId === ids[0])!;
    expect(row.choiceId).toBeNull();
    expect(row.tried).toEqual([{ text: guess, byPlayerId: ids[0] }]);
  });

  it("carries the room's rejected guesses onto every co-op row", async () => {
    const { room, ids } = seed(3);
    await startHeardle(room, ids[0]!, "heardle-coop");

    store.submitAnswer(room, ids[0]!, 0, "Wrong One");
    store.submitAnswer(room, ids[1]!, 0, "Wrong Two");
    store.submitAnswer(room, ids[2]!, 0, answerOf(room));

    for (const id of ids) {
      const row = room.reveal!.results.find((r) => r.playerId === id)!;
      // Each rung the room spent is credited to whoever spent it.
      expect(row.tried).toEqual([
        { text: "Wrong One", byPlayerId: ids[0] },
        { text: "Wrong Two", byPlayerId: ids[1] },
      ]);
    }
  });
});
