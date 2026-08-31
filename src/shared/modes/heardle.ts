import { scoreHeardle } from "../scoring";
import type { DifficultySpec } from "../difficulty";
import { buildChoiceRounds } from "./rounds";
import type { BuildRoundsInput, GameMode, Judgement, JudgeInput, RoundPlan } from "./index";

/**
 * How long the room keeps answering after the music stops.
 *
 * The same five seconds Quiz allows, for the same reason: the silence is part
 * of the round, and a clip that ends the moment the clock does gives nobody
 * time to commit.
 */
export const HEARDLE_SILENCE_MS = 5_000;

/**
 * Wrong guesses allowed per Round, per player in `heardle` and per Room in
 * `heardle-coop`.
 *
 * Two, because there are four options: a third wrong guess would leave only the
 * right one standing and turn the last pick into a formality.
 */
export const HEARDLE_MAX_WRONG = 2;

/** Which tier the clip had reached at `elapsedMs`. */
export function stageAt(stagesMs: readonly number[], elapsedMs: number): number {
  const i = stagesMs.findIndex((end) => elapsedMs < end);
  // Past the last mark the music has stopped; that tier stays open through the
  // Silence rather than paying nothing at all.
  return i === -1 ? Math.max(stagesMs.length - 1, 0) : i;
}

function heardleTiming(d: DifficultySpec) {
  const stagesMs = d.heardleStages;
  const clipMs = stagesMs[stagesMs.length - 1] ?? d.clipMs;
  return { clipMs, answerWindowMs: clipMs + HEARDLE_SILENCE_MS, stagesMs };
}

function buildRounds(input: BuildRoundsInput): RoundPlan[] {
  return buildChoiceRounds(input, heardleTiming);
}

function judge({ plan, choiceId, elapsedMs, wrongSoFar }: JudgeInput): Judgement {
  const correct = choiceId === plan.answer.id;

  if (!correct) {
    const spent = wrongSoFar.length + 1;
    return {
      correct: false,
      gained: 0,
      // A wrong guess is not the end of the round — it costs points and one of
      // the two attempts, and the music keeps playing.
      final: spent >= HEARDLE_MAX_WRONG,
    };
  }

  return {
    correct: true,
    gained: scoreHeardle({
      correct: true,
      stageIndex: stageAt(plan.stagesMs, elapsedMs),
      stageCount: plan.stagesMs.length,
      wrongAttempts: wrongSoFar.length,
      multiplier: plan.multiplier,
    }),
    final: true,
  };
}

/**
 * Heardle, played against each other.
 *
 * The clip grows instead of stopping, and the score steps down as it does, so
 * the question is no longer "how fast can you tap" but "how little of the song
 * do you need". Attempts and score are each player's own.
 */
export const heardleMode: GameMode = {
  id: "heardle",
  shared: false,
  buildRounds,
  judge,
};

/**
 * Heardle, played together.
 *
 * Mechanically identical, socially the opposite: the Room shares one pair of
 * attempts and one score, so a wrong guess spends something that was not only
 * yours. That is the whole mode — it is why the strikes are broadcast here and
 * kept private in the competitive one.
 */
export const heardleCoopMode: GameMode = {
  id: "heardle-coop",
  shared: true,
  buildRounds,
  judge,
};
