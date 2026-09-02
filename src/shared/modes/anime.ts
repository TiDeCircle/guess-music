import { scoreAnswer } from "../scoring";
import { shuffle, type Rng } from "../rng";
import type { Choice, Track } from "../types";
import type { BuildRoundsInput, GameMode, Judgement, JudgeInput, RoundPlan } from "./index";

/** Four, like every other mode: the 2x2 grid is the shape of the whole UI. */
export const SERIES_CHOICE_COUNT = 4;

/** Within this many years, two shows count as the same era. */
const SAME_ERA_YEARS = 2;

type SeriesTrack = Track & { series: string };

const hasSeries = (t: Track): t is SeriesTrack => Boolean(t.series);

const toChoice = (series: string): Choice => ({ id: series, title: series });

/**
 * The year a show is represented by: the earliest release among its tracks. A
 * second opening released five years later should not drag the show forward
 * into an era it does not belong to.
 */
function yearsBySeries(tracks: readonly SeriesTrack[]): Map<string, number> {
  const years = new Map<string, number>();
  for (const t of tracks) {
    const known = years.get(t.series);
    if (known === undefined || (t.year > 0 && t.year < known)) {
      years.set(t.series, t.year);
    }
  }
  return years;
}

/**
 * Three wrong shows.
 *
 * `tight` prefers shows from the answer's own era, which is what stops the
 * decade being a free elimination on the harder levels. It is a preference,
 * not a guarantee: a pool with nothing nearby falls back to whatever is left
 * rather than dropping the round.
 */
function pickDecoySeries(
  answer: SeriesTrack,
  years: ReadonlyMap<string, number>,
  tight: boolean,
  rng: Rng,
): string[] {
  const others = [...years.keys()].filter((s) => s !== answer.series);
  if (!tight) return shuffle(others, rng).slice(0, SERIES_CHOICE_COUNT - 1);

  const near = others.filter(
    (s) => Math.abs((years.get(s) ?? 0) - answer.year) <= SAME_ERA_YEARS,
  );
  const nearSet = new Set(near);
  return [
    ...shuffle(near, rng),
    ...shuffle(
      others.filter((s) => !nearSet.has(s)),
      rng,
    ),
  ].slice(0, SERIES_CHOICE_COUNT - 1);
}

/**
 * One clip, four shows, name the one it opens.
 *
 * The first mode whose answer is not the thing being played, which is why it
 * sits beside `buildChoiceRounds` rather than calling it: a builder shared
 * between "four songs" and "four shows" would take a strategy and a key
 * extractor and satisfy neither caller.
 *
 * Playable only against a Playlist that ships a series map, which is what
 * `requiresSeries` says and what `sourceSuitsMode` enforces.
 */
export const animeMode: GameMode = {
  id: "anime",
  shared: false,
  typed: false,
  requiresSeries: true,

  buildRounds({ pool, count, difficulty, rng, exclude }: BuildRoundsInput): RoundPlan[] {
    const tracks = pool.filter(hasSeries);
    const years = yearsBySeries(tracks);
    // Fewer than four shows cannot fill the grid, whatever the pool holds in
    // songs.
    if (years.size < SERIES_CHOICE_COUNT) return [];

    const fresh = exclude ? tracks.filter((t) => !exclude.has(t.id)) : tracks;
    const answerPool = shuffle(fresh.length >= count ? fresh : tracks, rng);
    // easy and medium ask for `different-artist`; hard and extreme do not.
    const tight = difficulty.decoy !== "different-artist";

    const rounds: RoundPlan[] = [];
    const usedSeries = new Set<string>();

    for (const answer of answerPool) {
      if (rounds.length >= count) break;
      // A show with six openings is fine in the pool and would be tedious as
      // six answers. It earns one, and turns up as a decoy the rest of the
      // time — which is the right bias: a familiar wrong tile is what makes a
      // guess a guess.
      if (usedSeries.has(answer.series)) continue;

      const decoys = pickDecoySeries(answer, years, tight, rng);
      if (decoys.length < SERIES_CHOICE_COUNT - 1) continue;

      usedSeries.add(answer.series);
      rounds.push({
        index: rounds.length,
        answer,
        choices: shuffle([answer.series, ...decoys].map(toChoice), rng),
        correctChoiceId: answer.series,
        clipMs: difficulty.clipMs,
        answerWindowMs: difficulty.answerWindowMs,
        // No ladder here; the clip is what it is, exactly as in Quiz.
        stagesMs: [],
        multiplier: difficulty.multiplier,
      });
    }

    return rounds;
  },

  judge({ plan, guess, elapsedMs }: JudgeInput): Judgement {
    // `guess` arrives trimmed and non-empty, so an answer with no series can
    // never accidentally match.
    const correct = guess === plan.answer.series;
    return {
      correct,
      gained: scoreAnswer({
        correct,
        elapsedMs,
        windowMs: plan.answerWindowMs,
        multiplier: plan.multiplier,
      }),
      // Right or wrong, an anime answer is final. That is what makes the speed
      // bonus mean anything, the same as in Quiz.
      final: true,
      // No ladder to climb; the clip is what it is.
      level: 0,
    };
  },
};
