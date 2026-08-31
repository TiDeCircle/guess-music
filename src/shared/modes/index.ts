import type { Choice, GameModeId, Track } from "../types";
import type { DifficultySpec } from "../difficulty";
import type { Rng } from "../rng";

/** A Round as the server holds it — this one knows the answer. */
export type RoundPlan = {
  index: number;
  answer: Track;
  choices: Choice[];
  clipMs: number;
  answerWindowMs: number;
  /**
   * Where the score tier drops, in ms from the Round opening. Empty in Quiz,
   * whose single tier decays continuously instead.
   */
  stagesMs: number[];
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

export type JudgeInput = {
  plan: RoundPlan;
  choiceId: string;
  /** ms from Round open to the server receiving this. Server clock only. */
  elapsedMs: number;
  /**
   * Wrong choiceIds already spent on this Round — by this player, or by the
   * whole Room when the mode is shared.
   */
  wrongSoFar: readonly string[];
};

export type Judgement = {
  correct: boolean;
  gained: number;
  /**
   * Whether this ends the Round for whoever guessed. False is what lets Heardle
   * hand back a wrong answer and keep the music running.
   */
  final: boolean;
};

/**
 * A Game Mode owns the rules of a Round: what the player is shown, how long
 * they get, and what counts as correct.
 *
 * The interface exists so the Room machinery never branches on which mode is
 * running — it asks `judge` what an answer was worth and `shared` who it
 * belongs to, and it would keep working for a fourth mode nobody has written.
 */
export type GameMode = {
  id: GameModeId;
  /**
   * True when the Room answers as one: a single set of attempts, and points
   * that land on everybody rather than on whoever tapped.
   */
  shared: boolean;
  buildRounds(input: BuildRoundsInput): RoundPlan[];
  judge(input: JudgeInput): Judgement;
};

export { quizMode, CHOICE_COUNT } from "./quiz";
export { heardleMode, heardleCoopMode, HEARDLE_MAX_WRONG, stageAt } from "./heardle";

import { quizMode } from "./quiz";
import { heardleCoopMode, heardleMode } from "./heardle";

export const MODES: Record<GameModeId, GameMode> = {
  quiz: quizMode,
  heardle: heardleMode,
  "heardle-coop": heardleCoopMode,
};

/** The order the picker lays them out in: familiar first, then the twist. */
export const MODE_ORDER: GameModeId[] = ["quiz", "heardle", "heardle-coop"];

export const DEFAULT_MODE: GameModeId = "quiz";
