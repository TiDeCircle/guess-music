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

/**
 * What one Heardle unlock level is worth, already multiplied.
 *
 * Level 0 pays exactly what an instant Quiz answer pays, and the last level
 * pays exactly what a Quiz answer on the buzzer pays, so a Match is worth the
 * same whichever mode a Room picks — the choice stays about how you want to
 * play rather than which mode farms more points.
 *
 * There is no separate penalty for guessing wrong: a wrong guess spends a
 * level, and the level is the price.
 */
export function heardleTierPoints(
  level: number,
  levelCount: number,
  multiplier: number,
): number {
  const spread = Math.max(levelCount - 1, 1);
  const tier = Math.min(Math.max(level, 0), spread);
  return Math.round((BASE_POINTS + MAX_TIME_BONUS * (1 - tier / spread)) * multiplier);
}

/** How much one more consecutive correct answer adds to the streak bonus. */
export const STREAK_BONUS_PER_ANSWER = 0.05;

/** Where the streak bonus stops growing — five in a row buys the whole 25%. */
export const STREAK_BONUS_CAP = 0.25;

/**
 * What a round's own score is multiplied by, given the streak of correct
 * answers a player is carrying into it.
 *
 * Kept out of `scoreAnswer` and `heardleTierPoints` on purpose: those already
 * apply the difficulty multiplier, and folding a second multiplier in there
 * would make one call site responsible for two unrelated ideas. The caller
 * knows the streak — the round's own scoring functions never see player
 * history — so it applies this afterwards instead.
 */
export function streakMultiplier(streak: number): number {
  const bonus = Math.min(Math.max(streak, 0) * STREAK_BONUS_PER_ANSWER, STREAK_BONUS_CAP);
  return 1 + bonus;
}
