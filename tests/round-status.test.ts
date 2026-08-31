import { describe, expect, it } from "vitest";
import type { Player } from "@/shared/types";
import {
  FINAL_STRETCH_MS,
  answeredSummary,
  isFinalStretch,
} from "@/client/roundStatus";

const player = (id: string, connected = true): Player => ({
  id,
  name: id,
  score: 0,
  connected,
});

describe("isFinalStretch", () => {
  it("says nothing for most of the window", () => {
    expect(isFinalStretch(30_000, false)).toBe(false);
    expect(isFinalStretch(FINAL_STRETCH_MS + 1, false)).toBe(false);
  });

  it("turns on at the threshold and stays on to zero", () => {
    expect(isFinalStretch(FINAL_STRETCH_MS, false)).toBe(true);
    expect(isFinalStretch(1, false)).toBe(true);
    expect(isFinalStretch(0, false)).toBe(true);
  });

  // The clock can overshoot by a frame between the deadline and the reveal.
  it("stays on past zero rather than flicking off", () => {
    expect(isFinalStretch(-250, false)).toBe(true);
  });

  // While the room waits for everyone's audio there is no clock running, and a
  // red countdown there would be urgency about nothing.
  it("says nothing at all while the round is still loading", () => {
    expect(isFinalStretch(0, true)).toBe(false);
    expect(isFinalStretch(1_000, true)).toBe(false);
  });
});

describe("answeredSummary", () => {
  const players = [player("a"), player("b"), player("c")];

  it("counts who has answered out of everyone", () => {
    expect(answeredSummary(players, ["a"], [], false)).toEqual({
      done: 1,
      total: 3,
    });
  });

  // The strip shows readiness during `loading` and answers during `playing`,
  // so the count has to follow whichever one is on screen.
  it("counts buffered audio instead while the round is loading", () => {
    expect(answeredSummary(players, [], ["a", "b"], true)).toEqual({
      done: 2,
      total: 3,
    });
  });

  // A player who dropped mid-round is still shown in the strip, struck
  // through, and the room is not waiting on them — counting them in the total
  // would leave a room stuck reading "2/3" for the rest of the round.
  it("leaves disconnected players out of both halves", () => {
    const withDrop = [player("a"), player("b"), player("c", false)];
    expect(answeredSummary(withDrop, ["a"], [], false)).toEqual({
      done: 1,
      total: 2,
    });
    expect(answeredSummary(withDrop, ["a", "c"], [], false)).toEqual({
      done: 1,
      total: 2,
    });
  });

  it("survives an empty room", () => {
    expect(answeredSummary([], [], [], false)).toEqual({ done: 0, total: 0 });
  });
});
