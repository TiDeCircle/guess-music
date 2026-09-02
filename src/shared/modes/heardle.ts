import { matchesTitle } from "../answer";
import { heardleTierPoints } from "../scoring";
import { shuffle } from "../rng";
import type { DifficultySpec } from "../difficulty";
import type { BuildRoundsInput, GameMode, Judgement, JudgeInput, RoundPlan } from "./index";

/**
 * How long a Round stays open past the last unlock.
 *
 * Generous on purpose. A Quiz round is a reflex; a Heardle round is listening,
 * deciding whether to spend a level, and then typing a Thai song title on a
 * phone. Rushing that would make the mode about thumbs again. The Round still
 * closes the instant everyone has committed, so the window is a backstop rather
 * than a pace.
 */
export const HEARDLE_TYPING_MS = 25_000;

/** How much of the Preview is audible at a given unlock level. */
export function unlockedMs(stagesMs: readonly number[], level: number): number {
  if (stagesMs.length === 0) return 0;
  const capped = Math.min(Math.max(level, 0), stagesMs.length - 1);
  return stagesMs[capped]!;
}

function heardleTiming(d: DifficultySpec) {
  const stagesMs = d.heardleStages;
  const clipMs = stagesMs[stagesMs.length - 1] ?? d.clipMs;
  return { clipMs, answerWindowMs: clipMs + HEARDLE_TYPING_MS, stagesMs };
}

/**
 * Rounds without options.
 *
 * No decoys are picked, which is not just a saving: a typed Round has nothing
 * to show, so the thin-pool rule that made Quiz skip a track it could not
 * surround with three plausible wrong answers does not apply here. Heardle will
 * happily play a Playlist too small for Quiz.
 */
function buildRounds({ pool, count, difficulty, rng, exclude }: BuildRoundsInput): RoundPlan[] {
  const fresh = exclude ? pool.filter((t) => !exclude.has(t.id)) : pool;
  const answers = shuffle(fresh.length >= count ? fresh : pool, rng);
  const { clipMs, answerWindowMs, stagesMs } = heardleTiming(difficulty);

  const rounds: RoundPlan[] = [];
  const used = new Set<string>();

  for (const answer of answers) {
    if (rounds.length >= count) break;
    // No Track is ever the answer twice in one Match — and with typed answers,
    // two pressings of one recording would read as the same song too.
    const key = answer.title.trim().toLowerCase();
    if (used.has(answer.id) || used.has(key)) continue;
    used.add(answer.id);
    used.add(key);

    rounds.push({
      index: rounds.length,
      answer,
      choices: [],
      // Nothing on screen to be right, but the reveal still names what the
      // answer was.
      correctChoiceId: answer.id,
      clipMs,
      answerWindowMs,
      stagesMs,
      multiplier: difficulty.multiplier,
    });
  }

  return rounds;
}

function judge({ plan, guess, level }: JudgeInput): Judgement {
  const last = Math.max(plan.stagesMs.length - 1, 0);
  const at = Math.min(Math.max(level, 0), last);

  if (matchesTitle(guess, plan.answer.title)) {
    return {
      correct: true,
      gained: heardleTierPoints(at, plan.stagesMs.length, plan.multiplier),
      final: true,
      level: at,
    };
  }

  // A wrong guess buys the next level, exactly as skipping would. There is no
  // extra penalty because there does not need to be one — the level you land on
  // is what you will be paid, and you have one fewer left to spend.
  const next = at + 1;
  return { correct: false, gained: 0, final: next > last, level: Math.min(next, last) };
}

/**
 * Heardle, played against each other.
 *
 * You hear a second of the song and name it, or spend a level to hear more. The
 * question is how little of the song you need, not how fast you can tap, and
 * the answer is typed so that recognising a title on screen is worth nothing.
 * Levels and score are each player's own.
 */
export const heardleMode: GameMode = {
  id: "heardle",
  shared: false,
  typed: true,
  requiresSeries: false,
  buildRounds,
  judge,
};

/**
 * Heardle, played together.
 *
 * Mechanically identical, socially the opposite: the Room shares one ladder and
 * one score, so unlocking the next five seconds spends something that was not
 * only yours, and so does guessing wrong.
 */
export const heardleCoopMode: GameMode = {
  id: "heardle-coop",
  shared: true,
  typed: true,
  requiresSeries: false,
  buildRounds,
  judge,
};
