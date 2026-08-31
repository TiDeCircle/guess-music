import type { Choice, Track } from "../types";
import type { DecoyStrategy, DifficultySpec } from "../difficulty";
import { titleKeys } from "../answer";
import { shuffle, type Rng } from "../rng";
import type { BuildRoundsInput, RoundPlan } from "./index";

/** Fixed at four everywhere: the 2x2 grid is the shape of the whole UI. */
export const CHOICE_COUNT = 4;

/** How many same-artist decoys each strategy wants, when the pool allows. */
const SAME_ARTIST_TARGET: Record<DecoyStrategy, number> = {
  "different-artist": 0,
  mixed: 1,
  "same-artist": 2,
};

const toChoice = (t: Track): Choice => ({
  id: t.id,
  title: t.title,
});

/**
 * Two tracks collide as choices if they'd read identically on screen, which
 * since the artist came off the tile means: same title. Different iTunes ids
 * for the same song (single vs album release) are common, and so are covers —
 * either way two tiles reading the same thing with one of them scored wrong is
 * a round nobody can answer.
 *
 * This deliberately rejects more pairs than it used to. A cover by a different
 * act was previously allowed alongside the original because the artist line
 * told them apart; nothing tells them apart now.
 *
 * It compares through `titleKeys`, which also strips the production suffix, so
 * "ฝุ่น" and "ฝุ่น (Version Piano)" count as one song. They were two tiles
 * reading the same thing with one of them wrong — and it is the same rule the
 * typed answers are graded by, so both modes now agree on what one song is.
 */
const sameLabel = (a: Track, b: Track) => {
  const left = titleKeys(a.title);
  return titleKeys(b.title).some((k) => left.includes(k));
};

/**
 * Build the wrong options for one Round.
 *
 * The same-artist target is a preference, not a guarantee: a pool may simply
 * not hold three other songs by that artist. Rather than fail the round we fall
 * back to different-artist decoys, so a thin Category still plays.
 */
function pickDecoys(
  answer: Track,
  pool: readonly Track[],
  strategy: DecoyStrategy,
  rng: Rng,
): Track[] {
  const usable = pool.filter((t) => t.id !== answer.id && !sameLabel(t, answer));
  const sameArtist = shuffle(
    usable.filter((t) => t.artistId === answer.artistId),
    rng,
  );
  const otherArtist = shuffle(
    usable.filter((t) => t.artistId !== answer.artistId),
    rng,
  );

  const decoys: Track[] = [];
  const want = CHOICE_COUNT - 1;

  for (const t of sameArtist) {
    if (decoys.length >= SAME_ARTIST_TARGET[strategy]) break;
    if (decoys.some((d) => sameLabel(d, t))) continue;
    decoys.push(t);
  }

  // One decoy per artist among the "different" ones, so an easy round doesn't
  // show three songs by the same wrong band.
  const usedArtists = new Set(decoys.map((d) => d.artistId));
  for (const t of otherArtist) {
    if (decoys.length >= want) break;
    if (usedArtists.has(t.artistId)) continue;
    if (decoys.some((d) => sameLabel(d, t))) continue;
    decoys.push(t);
    usedArtists.add(t.artistId);
  }

  // Still short (tiny pool): relax the one-per-artist rule, then give up.
  for (const t of [...sameArtist, ...otherArtist]) {
    if (decoys.length >= want) break;
    if (decoys.some((d) => d.id === t.id || sameLabel(d, t))) continue;
    decoys.push(t);
  }

  return decoys;
}

/** How long a Round runs and where its score steps, for one difficulty. */
export type RoundTiming = {
  clipMs: number;
  answerWindowMs: number;
  stagesMs: number[];
};

/**
 * The part every mode shares: pick answers, surround each with decoys, and lay
 * them out as Rounds.
 *
 * Only the timing differs between Quiz and Heardle, so that is the one thing
 * passed in. Both modes show four options built the same way, which is also why
 * a Room can switch mode without the pool meaning anything different.
 */
export function buildChoiceRounds(
  { pool, count, difficulty, rng, exclude }: BuildRoundsInput,
  timing: (difficulty: DifficultySpec) => RoundTiming,
): RoundPlan[] {
  // Answers avoid recently-played tracks, but the decoy pool stays whole —
  // a song being a stale answer is no reason it can't be a wrong option.
  const fresh = exclude ? pool.filter((t) => !exclude.has(t.id)) : pool;
  const answerPool = shuffle(fresh.length >= count ? fresh : pool, rng);
  const { clipMs, answerWindowMs, stagesMs } = timing(difficulty);

  const rounds: RoundPlan[] = [];
  const usedAnswers = new Set<string>();

  for (const answer of answerPool) {
    if (rounds.length >= count) break;
    // No Track is ever the answer twice in one Match.
    if (usedAnswers.has(answer.id)) continue;

    const decoys = pickDecoys(answer, pool, difficulty.decoy, rng);
    // A round with fewer than four options would break the grid; skip the
    // track rather than render a lopsided one.
    if (decoys.length < CHOICE_COUNT - 1) continue;

    usedAnswers.add(answer.id);
    rounds.push({
      index: rounds.length,
      answer,
      choices: shuffle([answer, ...decoys].map(toChoice), rng),
      clipMs,
      answerWindowMs,
      stagesMs,
      multiplier: difficulty.multiplier,
    });
  }

  return rounds;
}
