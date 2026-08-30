import { describe, expect, it } from "vitest";
import { BASE_POINTS, MAX_TIME_BONUS, scoreAnswer } from "@/shared/scoring";
import { DIFFICULTIES } from "@/shared/difficulty";

describe("scoreAnswer", () => {
  it("gives nothing for a wrong answer, however fast", () => {
    expect(
      scoreAnswer({ correct: false, elapsedMs: 0, windowMs: 15_000, multiplier: 2 }),
    ).toBe(0);
  });

  it("gives the full bonus for an instant answer", () => {
    expect(
      scoreAnswer({ correct: true, elapsedMs: 0, windowMs: 15_000, multiplier: 1 }),
    ).toBe(BASE_POINTS + MAX_TIME_BONUS);
  });

  it("gives base points only when the answer lands on the deadline", () => {
    expect(
      scoreAnswer({ correct: true, elapsedMs: 15_000, windowMs: 15_000, multiplier: 1 }),
    ).toBe(BASE_POINTS);
  });

  // These are the numbers the design was agreed on: a medium round with a
  // 15s window, answered at 3.2s and 5.6s.
  it("matches the worked example from the design", () => {
    const window = DIFFICULTIES.medium.answerWindowMs;
    const mult = DIFFICULTIES.medium.multiplier;
    expect(scoreAnswer({ correct: true, elapsedMs: 3_200, windowMs: window, multiplier: mult })).toBe(179);
    expect(scoreAnswer({ correct: true, elapsedMs: 5_600, windowMs: window, multiplier: mult })).toBe(163);
  });

  it("never pays more than the maximum, even with a skewed clock", () => {
    const max = (BASE_POINTS + MAX_TIME_BONUS) * 2;
    expect(
      scoreAnswer({ correct: true, elapsedMs: -5_000, windowMs: 8_000, multiplier: 2 }),
    ).toBe(max);
  });

  it("never goes negative when an answer arrives past the deadline", () => {
    expect(
      scoreAnswer({ correct: true, elapsedMs: 99_000, windowMs: 8_000, multiplier: 2 }),
    ).toBe(BASE_POINTS * 2);
  });

  it("scales with difficulty: extreme is worth double easy for the same speed", () => {
    const at = (id: "easy" | "extreme") =>
      scoreAnswer({
        correct: true,
        elapsedMs: 0,
        windowMs: DIFFICULTIES[id].answerWindowMs,
        multiplier: DIFFICULTIES[id].multiplier,
      });
    expect(at("extreme") / at("easy")).toBeCloseTo(2 / 0.75, 5);
  });
});

describe("difficulty table", () => {
  it("never lets the music outlast the answer window", () => {
    for (const spec of Object.values(DIFFICULTIES)) {
      expect(spec.clipMs).toBeLessThanOrEqual(spec.answerWindowMs);
    }
  });

  it("gets harder and more valuable in step", () => {
    const order = ["easy", "medium", "hard", "extreme"] as const;
    for (let i = 1; i < order.length; i++) {
      const prev = DIFFICULTIES[order[i - 1]!];
      const cur = DIFFICULTIES[order[i]!];
      expect(cur.clipMs).toBeLessThan(prev.clipMs);
      expect(cur.multiplier).toBeGreaterThan(prev.multiplier);
    }
  });
});
