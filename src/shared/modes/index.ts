import type { Choice, GameModeId, Track } from "../types";
import type { DifficultySpec } from "../difficulty";
import type { Rng } from "../rng";

/** A Round as the server holds it — this one knows the answer. */
export type RoundPlan = {
  index: number;
  answer: Track;
  /** The options on screen. Empty in a typed mode, which shows none. */
  choices: Choice[];
  /**
   * Which `choices` entry is the right one. Not always the answer's track id:
   * an anime Round's tiles are shows, so the winning tile is named by the
   * series. The mode builds the choices, so the mode is what can say.
   */
  correctChoiceId: string;
  clipMs: number;
  answerWindowMs: number;
  /**
   * Heardle: how much of the Preview each unlock level hands over. Empty in
   * Quiz, whose clip is fixed for the whole Round.
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
  /** A choice id in Quiz; whatever the player typed in Heardle. */
  guess: string;
  /** ms from Round open to the server receiving this. Server clock only. */
  elapsedMs: number;
  /** How far the clip has been unlocked for whoever is guessing. */
  level: number;
};

export type Judgement = {
  correct: boolean;
  gained: number;
  /**
   * Whether this ends the Round for whoever guessed. False is what lets Heardle
   * hand a wrong guess back and keep the round alive.
   */
  final: boolean;
  /**
   * The unlock level after this guess. A wrong Heardle guess spends one, which
   * is both the penalty and the consolation: more music, fewer points.
   */
  level: number;
};

/**
 * A Game Mode owns the rules of a Round: what the player is shown, how long
 * they get, and what counts as correct.
 *
 * The interface exists so the Room machinery never branches on which mode is
 * running — it asks `judge` what a guess was worth and `shared` who it belongs
 * to, and it would keep working for a fourth mode nobody has written.
 */
export type GameMode = {
  id: GameModeId;
  /**
   * True when the Room answers as one: a single ladder of unlocks, and points
   * that land on everybody rather than on whoever guessed.
   */
  shared: boolean;
  /**
   * True when the answer is typed rather than picked off the screen. A typed
   * Round sends no options at all, so the answer is never on the wire before
   * the reveal.
   */
  typed: boolean;
  /**
   * True when the mode asks about something only a series-bearing Playlist can
   * answer. Naming the requirement rather than a Playlist group is what lets a
   * second anime Playlist become selectable by carrying the data, with nothing
   * here to update.
   */
  requiresSeries: boolean;
  buildRounds(input: BuildRoundsInput): RoundPlan[];
  judge(input: JudgeInput): Judgement;
};

export { quizMode, CHOICE_COUNT } from "./quiz";
export { heardleMode, heardleCoopMode, unlockedMs } from "./heardle";
export { animeMode, SERIES_CHOICE_COUNT } from "./anime";

import { quizMode } from "./quiz";
import { heardleCoopMode, heardleMode } from "./heardle";
import { animeMode } from "./anime";

export const MODES: Record<GameModeId, GameMode> = {
  quiz: quizMode,
  heardle: heardleMode,
  "heardle-coop": heardleCoopMode,
  anime: animeMode,
};

/**
 * The order the picker lays them out in: familiar first, then the twist.
 *
 * `heardle-coop` is not in here — it is a `GameModeId` a Room can genuinely
 * run, but not a card of its own in `ModePicker`, which folds it into the
 * "Heardle" card as a second choice instead of a third parallel one. Anything
 * that needs to enumerate every actual mode (there is nothing today) should
 * read `MODES`, not this.
 */
export const MODE_ORDER: GameModeId[] = ["quiz", "heardle"];

export const DEFAULT_MODE: GameModeId = "quiz";
