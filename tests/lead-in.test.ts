import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";
import { DIFFICULTIES } from "@/shared/difficulty";
import { scoreAnswer } from "@/shared/scoring";

// Same fixed pool as the lifecycle tests: this file is about when the clock
// starts, not about what comes out of iTunes.
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

const { RoomStore, ROOM_TUNING } = await import("@/server/rooms");

let store: InstanceType<typeof RoomStore>;

beforeEach(() => {
  vi.useFakeTimers();
  store = new RoomStore({
    onState: () => {},
    onClosed: () => {},
    onListingChanged: () => {},
  });
});

afterEach(() => {
  store.stop();
  vi.useRealTimers();
});

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

/** Everyone buffered; the Round is open but has not gone live yet. */
async function armed(players = 2) {
  const { room, ids } = seed(players);
  await startMedium(room, ids[0]!);
  for (const id of ids) store.markReady(room, id, 0);
  return { room, ids };
}

describe("the count-in", () => {
  // Three whole seconds, so the client can show 3, then 2, then 1, and have
  // the music land on zero rather than halfway through the "1".
  it("gives the first round of a match room for three counts", () => {
    expect(ROOM_TUNING.FIRST_LEAD_IN_MS).toBe(3_000);
  });

  it("is longer than the beat every other round gets", () => {
    expect(ROOM_TUNING.FIRST_LEAD_IN_MS).toBeGreaterThan(ROOM_TUNING.LEAD_IN_MS);
  });

  it("counts the match in, then stops counting", async () => {
    const { room, ids } = await armed(1);

    // Round one: the long one.
    expect(room.match!.startAt).toBe(Date.now() + ROOM_TUNING.FIRST_LEAD_IN_MS);
    vi.advanceTimersByTime(ROOM_TUNING.FIRST_LEAD_IN_MS);
    store.submitAnswer(room, ids[0]!, 0, room.match!.rounds[0]!.answer.id);
    expect(room.phase).toBe("reveal");

    // Round two: back to the short beat, because by now the room is watching.
    vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
    expect(room.phase).toBe("loading");
    store.markReady(room, ids[0]!, 1);
    expect(room.match!.startAt).toBe(Date.now() + ROOM_TUNING.LEAD_IN_MS);
  });

  it("counts a rematch in again from the top", async () => {
    const { room, ids } = await armed(1);
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(Math.max(room.match!.startAt - Date.now(), 0));
      store.submitAnswer(room, ids[0]!, i, room.match!.rounds[i]!.answer.id);
      vi.advanceTimersByTime(ROOM_TUNING.REVEAL_MS + 50);
      if (room.phase === "loading") store.markReady(room, ids[0]!, i + 1);
    }
    expect(room.phase).toBe("finished");

    store.returnToLobby(room, ids[0]!);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);
    expect(room.match!.startAt).toBe(Date.now() + ROOM_TUNING.FIRST_LEAD_IN_MS);
  });
});

describe("the lead-in", () => {
  it("puts the start in the future rather than starting on the last buffer", async () => {
    const { room } = await armed();

    expect(room.phase).toBe("playing");
    expect(room.match!.startAt).toBe(Date.now() + ROOM_TUNING.FIRST_LEAD_IN_MS);
  });

  // The whole point of a lead-in is that the player is not paying for it. If
  // the deadline were measured from the moment everyone buffered, the lead-in
  // would come straight out of the answer window.
  it("does not spend any of the answer window on itself", async () => {
    const { room } = await armed();
    const plan = room.match!.rounds[0]!;

    expect(room.match!.deadlineAt - room.match!.startAt).toBe(plan.answerWindowMs);
  });

  it("still starts after the ready timeout when a client never reports", async () => {
    const { room, ids } = seed(2);
    await startMedium(room, ids[0]!);
    store.markReady(room, ids[0]!, 0);

    // Advanced to the timeout exactly, so "now" is the instant it fired and the
    // lead-in can be measured from it.
    vi.advanceTimersByTime(ROOM_TUNING.AUDIO_READY_TIMEOUT_MS);
    expect(room.phase).toBe("playing");
    expect(room.match!.startAt).toBe(Date.now() + ROOM_TUNING.FIRST_LEAD_IN_MS);
  });
});

describe("answering during the lead-in", () => {
  // Without this guard the clip has not been heard yet and the elapsed time is
  // negative, which `scoreAnswer` clamps to the maximum bonus — so answering
  // blind would have paid better than answering well.
  it("is refused before the clip starts", async () => {
    const { room, ids } = await armed();
    const correct = room.match!.rounds[0]!.answer.id;

    expect(store.submitAnswer(room, ids[0]!, 0, correct)).toBeNull();
    expect(room.players.get(ids[0]!)!.score).toBe(0);
  });

  it("is refused right up to the last millisecond of it", async () => {
    const { room, ids } = await armed();
    const correct = room.match!.rounds[0]!.answer.id;

    vi.advanceTimersByTime(ROOM_TUNING.FIRST_LEAD_IN_MS - 1);
    expect(store.submitAnswer(room, ids[0]!, 0, correct)).toBeNull();
  });

  it("is accepted the moment the clip starts", async () => {
    const { room, ids } = await armed();
    const correct = room.match!.rounds[0]!.answer.id;

    vi.advanceTimersByTime(ROOM_TUNING.FIRST_LEAD_IN_MS);
    expect(store.submitAnswer(room, ids[0]!, 0, correct)).toMatchObject({
      correct: true,
    });
  });

  // Answering on the first beat of the clip should pay exactly what answering
  // instantly has always paid — proof the clock the score is measured against
  // is the one that starts with the music.
  it("pays a full time bonus for an answer on the first beat", async () => {
    const { room, ids } = await armed();
    const plan = room.match!.rounds[0]!;
    const correct = plan.answer.id;

    vi.advanceTimersByTime(ROOM_TUNING.FIRST_LEAD_IN_MS);
    store.submitAnswer(room, ids[0]!, 0, correct);

    expect(room.players.get(ids[0]!)!.score).toBe(
      scoreAnswer({
        correct: true,
        elapsedMs: 0,
        windowMs: plan.answerWindowMs,
        multiplier: DIFFICULTIES.medium.multiplier,
      }),
    );
  });
});

describe("closing the round", () => {
  it("waits out the lead-in as well as the window", async () => {
    const { room } = await armed();
    const plan = room.match!.rounds[0]!;

    // One millisecond short of the whole thing: still live.
    vi.advanceTimersByTime(ROOM_TUNING.FIRST_LEAD_IN_MS + plan.answerWindowMs - 1);
    expect(room.phase).toBe("playing");

    vi.advanceTimersByTime(1);
    expect(room.phase).toBe("reveal");
  });
});
