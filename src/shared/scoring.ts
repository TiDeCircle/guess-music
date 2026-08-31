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
 * What one wrong guess costs in Heardle, before the multiplier.
 *
 * Big enough that guessing to eliminate is a real trade rather than free
 * information, small enough that it is still worth guessing again.
 */
export const HEARDLE_WRONG_PENALTY = 40;

/** The floor a correct Heardle answer cannot be penalised below. */
export const HEARDLE_MIN_CORRECT = 30;

/**
 * What a Heardle tier is worth before any penalty, already multiplied.
 *
 * The first tier pays exactly what an instant Quiz answer pays and the last
 * pays exactly what a Quiz answer on the buzzer pays, so a Match is worth the
 * same whichever mode a Room picks.
 */
export function heardleTierPoints(
  stageIndex: number,
  stageCount: number,
  multiplier: number,
): number {
  const spread = Math.max(stageCount - 1, 1);
  const tier = Math.min(Math.max(stageIndex, 0), spread);
  return Math.round((BASE_POINTS + MAX_TIME_BONUS * (1 - tier / spread)) * multiplier);
}

export type HeardleScoreInput = {
  correct: boolean;
  /** Which tier the clip had reached when the answer landed. */
  stageIndex: number;
  stageCount: number;
  /** How many wrong guesses were already spent on this Round. */
  wrongAttempts: number;
  multiplier: number;
};

/**
 * Heardle scores by tier rather than by the clock: everyone answering inside
 * the same stretch of music gets the same points, which is what makes "I got it
 * in two seconds" mean something you can say out loud.
 */
export function scoreHeardle({
  correct,
  stageIndex,
  stageCount,
  wrongAttempts,
  multiplier,
}: HeardleScoreInput): number {
  if (!correct) return 0;
  const earned = heardleTierPoints(stageIndex, stageCount, multiplier);
  const penalty = HEARDLE_WRONG_PENALTY * Math.max(wrongAttempts, 0) * multiplier;
  // Floored rather than zeroed: someone who eliminated their way to the right
  // answer did still get it, and a round that can pay nothing is a round nobody
  // finishes.
  return Math.round(Math.max(earned - penalty, HEARDLE_MIN_CORRECT * multiplier));
}
