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
    source: { kind: "playlist", playlist: "thai-classic" },
    difficulty: "medium",
    roundCount: 3,
  });
  await store.startMatch(room, hostId);
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
      source: { kind: "artist", artist: "Bodyslam" },
      difficulty: "hard",
      roundCount: 5,
    });
    expect(toRoomState(room).config.source).toEqual({
      kind: "artist",
      artist: "Bodyslam",
    });
  });

  it("only lets the host change the config", () => {
    const { room, ids } = seed(2);
    expect(() =>
      store.setConfig(room, ids[1]!, {
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

    vi.advanceTimersByTime(room.match!.rounds[0]!.answerWindowMs + 50);
    expect(room.phase).toBe("reveal");
    expect(room.reveal!.results.find((r) => r.playerId === ids[1])!.choiceId).toBeNull();
  });

  it("pays more for a faster correct answer", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);
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
    store.submitAnswer(room, ids[0]!, 5, room.match!.rounds[0]!.answer.id);
    expect(room.players.get(ids[0]!)!.score).toBe(0);
  });

  it("ignores a choice id that is not on the board", async () => {
    const { room, ids } = seed(1);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
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
      expect(room.phase).toBe("playing");
      store.submitAnswer(room, ids[0]!, i, room.match!.rounds[i]!.answer.id);
      expect(room.phase).toBe("reveal");
      vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
    }
    expect(room.phase).toBe("finished");
  });

  it("does not stall when the only player still connected has answered", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    store.markReady(room, ids[1]!, 0);

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
    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    expect(states).toBeGreaterThan(before + 2);
  });
});
