import type { Choice, Track } from "../types";
import type { DifficultySpec } from "../difficulty";
import type { Rng } from "../rng";

/** A Round as the server holds it — this one knows the answer. */
export type RoundPlan = {
  index: number;
  answer: Track;
  choices: Choice[];
  clipMs: number;
  answerWindowMs: number;
  multiplier: number;
};

export type BuildRoundsInput = {
  /** Candidate Tracks for this Category, already deduplicated. */
  pool: Track[];
  count: number;
  difficulty: DifficultySpec;
  rng: Rng;
  /** Tracks used by recent Matches in this Room; avoided when possible. */
  exclude?: ReadonlySet<string>;
};

/**
 * A Game Mode owns the rules of a Round: what the player is shown, how long
 * they get, and what counts as correct.
 *
 * Quiz is the only mode today. Heardle is the reason this is an interface
 * rather than a function — it needs the same Match/Room machinery but replaces
 * a fixed Answer Window with escalating clip lengths and multiple attempts.
 * Nothing outside this folder should branch on which mode is running.
 */
export type GameMode = {
  id: string;
  buildRounds(input: BuildRoundsInput): RoundPlan[];
};

export { quizMode } from "./quiz";
