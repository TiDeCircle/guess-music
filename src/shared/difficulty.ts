import type { DifficultyId } from "./types";

/**
 * How close the wrong options sit to the right one.
 *
 * `same-artist` is the real jump in difficulty: when two decoys are other
 * songs by the same artist, recognising the voice tells you nothing and you
 * have to actually know the song.
 */
export type DecoyStrategy = "different-artist" | "mixed" | "same-artist";

export type DifficultySpec = {
  id: DifficultyId;
  /** How long the Preview is audible. */
  clipMs: number;
  /** How long answers are accepted. Always >= clipMs. */
  answerWindowMs: number;
  /** Multiplies the whole round score, so harder levels are worth choosing. */
  multiplier: number;
  decoy: DecoyStrategy;
  /**
   * Heardle only: how much of the Preview each unlock level hands over, in
   * order. Level 0 is what a player hears before touching anything.
   *
   * Difficulty has to mean something in a mode with no fixed clip, and this is
   * where it lands: a harder level gives less music at every step, so the whole
   * ladder is stingier rather than merely faster.
   */
  heardleStages: number[];
};

/**
 * The four levels. The gaps are deliberately wide — 15/10/5/3 reads as four
 * different games, where something like 15/12/9/6 would feel like one game
 * with a slider nobody can hear the difference on.
 *
 * Answer Window is clip + 5s throughout: the silence after the music stops is
 * part of the challenge, but a long empty stare is not.
 */
export const DIFFICULTIES: Record<DifficultyId, DifficultySpec> = {
  easy: {
    id: "easy",
    clipMs: 15_000,
    answerWindowMs: 20_000,
    multiplier: 0.75,
    decoy: "different-artist",
    heardleStages: [2_000, 6_000, 12_000, 20_000],
  },
  medium: {
    id: "medium",
    clipMs: 10_000,
    answerWindowMs: 15_000,
    multiplier: 1,
    decoy: "different-artist",
    heardleStages: [1_000, 5_000, 10_000, 15_000],
  },
  hard: {
    id: "hard",
    clipMs: 5_000,
    answerWindowMs: 10_000,
    multiplier: 1.5,
    decoy: "mixed",
    heardleStages: [1_000, 3_000, 6_000, 10_000],
  },
  extreme: {
    id: "extreme",
    clipMs: 3_000,
    answerWindowMs: 8_000,
    multiplier: 2,
    decoy: "same-artist",
    heardleStages: [1_000, 2_000, 4_000, 6_000],
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = [
  "easy",
  "medium",
  "hard",
  "extreme",
];

export const DEFAULT_DIFFICULTY: DifficultyId = "medium";
