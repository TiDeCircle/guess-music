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
  },
  medium: {
    id: "medium",
    clipMs: 10_000,
    answerWindowMs: 15_000,
    multiplier: 1,
    decoy: "different-artist",
  },
  hard: {
    id: "hard",
    clipMs: 5_000,
    answerWindowMs: 10_000,
    multiplier: 1.5,
    decoy: "mixed",
  },
  extreme: {
    id: "extreme",
    clipMs: 3_000,
    answerWindowMs: 8_000,
    multiplier: 2,
    decoy: "same-artist",
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = [
  "easy",
  "medium",
  "hard",
  "extreme",
];

export const DEFAULT_DIFFICULTY: DifficultyId = "medium";
