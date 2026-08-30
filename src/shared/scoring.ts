/**
 * Scoring lives here, alone, because it is the part most likely to be quietly
 * wrong. It is a pure function of numbers so the tests can pin it down.
 *
 * The elapsed time passed in must always be measured by the server, from when
 * it opened the Round to when it received the answer. A client-reported time
 * would be trivially forgeable and would also punish slow connections twice.
 */

/** Awarded for being right at all, before any speed bonus. */
export const BASE_POINTS = 100;

/** The most that answering instantly can add on top of BASE_POINTS. */
export const MAX_TIME_BONUS = 100;

export type ScoreInput = {
  correct: boolean;
  /** ms from Round open to the server receiving the answer. */
  elapsedMs: number;
  /** The Round's Answer Window in ms. */
  windowMs: number;
  /** The difficulty multiplier. */
  multiplier: number;
};

/**
 * A wrong answer scores zero regardless of speed — there is no consolation for
 * being confidently wrong quickly.
 */
export function scoreAnswer({
  correct,
  elapsedMs,
  windowMs,
  multiplier,
}: ScoreInput): number {
  if (!correct) return 0;
  if (windowMs <= 0) return Math.round(BASE_POINTS * multiplier);

  // Clamped both ways: a negative elapsed (clock skew) must not pay a bonus
  // above the maximum, and an answer landing on the deadline must not go
  // negative.
  const remaining = Math.min(Math.max(1 - elapsedMs / windowMs, 0), 1);
  const raw = BASE_POINTS + MAX_TIME_BONUS * remaining;
  return Math.round(raw * multiplier);
}
