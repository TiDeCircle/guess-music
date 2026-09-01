import { describe, expect, it } from "vitest";
import type { Player } from "@/shared/types";
import {
  FINAL_STRETCH_MS,
  answeredSummary,
  countInSeconds,
  isCountIn,
  isFinalStretch,
  isSounding,
} from "@/client/roundStatus";

const player = (id: string, connected = true): Player => ({
  id,
  name: id,
  score: 0,
  connected,
  muted: false,
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

describe("isCountIn", () => {
  it("is on for the round that opens a match, before the clip", () => {
    expect(isCountIn(0, 3_000, 0)).toBe(true);
    expect(isCountIn(0, 3_000, 2_999)).toBe(true);
  });

  it("is off the instant the clip starts", () => {
    expect(isCountIn(0, 3_000, 3_000)).toBe(false);
    expect(isCountIn(0, 3_000, 9_000)).toBe(false);
  });

  // Every round after the first gets a beat, not a count. A number that flashed
  // "2, 1" on the way past is noise, and a whole screen for it is worse.
  it("is off for every round after the first", () => {
    expect(isCountIn(1, 3_000, 0)).toBe(false);
    expect(isCountIn(9, 3_000, 0)).toBe(false);
  });
});

describe("countInSeconds", () => {
  it("counts three, two, one", () => {
    expect(countInSeconds(3_000, 0)).toBe(3);
    expect(countInSeconds(3_000, 1_000)).toBe(2);
    expect(countInSeconds(3_000, 2_000)).toBe(1);
  });

  // The clip lands on zero, so zero is a number this never shows: it would sit
  // on screen for a whole second promising a start that already happened.
  it("never shows a zero", () => {
    expect(countInSeconds(3_000, 2_999)).toBe(1);
    expect(countInSeconds(3_000, 3_000)).toBe(1);
    expect(countInSeconds(3_000, 5_000)).toBe(1);
  });

  it("holds a whole number for a whole second", () => {
    expect(countInSeconds(3_000, 1)).toBe(3);
    expect(countInSeconds(3_000, 999)).toBe(3);
    expect(countInSeconds(3_000, 1_001)).toBe(2);
  });
});

describe("isSounding", () => {
  it("is silent through the lead-in", () => {
    expect(isSounding(1_000, 10_000, 0)).toBe(false);
    expect(isSounding(1_000, 10_000, 999)).toBe(false);
  });

  it("starts exactly when the clip does", () => {
    expect(isSounding(1_000, 10_000, 1_000)).toBe(true);
  });

  it("runs to the end of the audible stretch and no further", () => {
    expect(isSounding(1_000, 10_000, 10_999)).toBe(true);
    expect(isSounding(1_000, 10_000, 11_000)).toBe(false);
    expect(isSounding(1_000, 10_000, 20_000)).toBe(false);
  });

  // Heardle's first rung is a single second, and the record has to stop for
  // the rest of the round rather than spin through the silence a player is
  // deciding in.
  it("follows a short unlocked stretch rather than the whole clip", () => {
    expect(isSounding(0, 1_000, 500)).toBe(true);
    expect(isSounding(0, 1_000, 1_500)).toBe(false);
  });

  it("is silent when nothing is audible at all", () => {
    expect(isSounding(0, 0, 0)).toBe(false);
  });
});
