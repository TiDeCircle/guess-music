import { describe, expect, it } from "vitest";
import { animeMode, SERIES_CHOICE_COUNT } from "@/shared/modes/anime";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import type { Track } from "@/shared/types";

/** `shows` series, `per` songs each, one year apart so eras stay distinct. */
function pool(shows: number, per: number): Track[] {
  const out: Track[] = [];
  for (let s = 0; s < shows; s++) {
    for (let n = 0; n < per; n++) {
      out.push({
        id: `${s}-${n}`,
        title: `Opening ${s}-${n}`,
        artist: `Artist ${s}`,
        artistId: s,
        artworkUrl: "https://example.test/art.jpg",
        previewUrl: `https://example.test/${s}-${n}.m4a`,
        year: 2000 + s,
        series: `Show ${s}`,
      });
    }
  }
  return out;
}

const build = (
  difficulty: keyof typeof DIFFICULTIES,
  tracks: Track[],
  count = 10,
  exclude?: Set<string>,
) =>
  animeMode.buildRounds({
    pool: tracks,
    count,
    difficulty: DIFFICULTIES[difficulty],
    rng: makeRng(4321),
    exclude,
  });

describe("anime rounds", () => {
  it("offers four distinct shows, one of them the answer's", () => {
    for (const rounds of [build("easy", pool(12, 3)), build("extreme", pool(12, 3))]) {
      expect(rounds).toHaveLength(10);
      for (const r of rounds) {
        expect(r.choices).toHaveLength(SERIES_CHOICE_COUNT);
        expect(new Set(r.choices.map((c) => c.id)).size).toBe(SERIES_CHOICE_COUNT);
        expect(r.choices.filter((c) => c.id === r.answer.series)).toHaveLength(1);
      }
    }
  });

  it("names the show, not the song, on every tile", () => {
    for (const r of build("medium", pool(12, 3))) {
      for (const c of r.choices) {
        expect(c.title).toMatch(/^Show \d+$/);
        expect(c.id).toBe(c.title);
      }
    }
  });

  // A show with six openings would otherwise be the answer six times.
  it("never uses the same show as the answer twice in one match", () => {
    const rounds = build("medium", pool(12, 5));
    const shows = rounds.map((r) => r.answer.series);
    expect(new Set(shows).size).toBe(shows.length);
  });

  it("ignores tracks that say nothing about what they are from", () => {
    const plain: Track = { ...pool(1, 1)[0]!, id: "plain", series: undefined };
    for (const r of build("easy", [...pool(6, 2), plain], 5)) {
      expect(r.answer.series).toBeTruthy();
      expect(r.choices.map((c) => c.id)).not.toContain(undefined);
    }
  });

  // Fewer than four shows cannot fill the grid, and a lopsided round is worse
  // than a missing one — the same call rounds.ts makes about decoys.
  it("builds nothing from a pool of fewer than four shows", () => {
    expect(build("medium", pool(3, 8))).toHaveLength(0);
  });

  it("keeps the hard decoys inside the answer's era", () => {
    // Two clusters forty years apart, each dense enough to fill a grid on its
    // own — so reaching across is a choice the builder made, not one the pool
    // forced.
    const era = (year: number, prefix: string) =>
      pool(6, 2).map((t) => ({
        ...t,
        id: `${prefix}-${t.id}`,
        series: `${prefix} ${t.series}`,
        year,
      }));

    for (const r of build("extreme", [...era(2010, "Old"), ...era(2050, "New")], 8)) {
      for (const c of r.choices) {
        expect(c.id.startsWith("New ")).toBe(r.answer.series!.startsWith("New "));
      }
    }
  });

  // The preference is not a guarantee: a pool with nothing nearby has to keep
  // playing rather than drop the round.
  it("reaches outside the era rather than lose the round", () => {
    const lonely: Track[] = pool(4, 2).map((t, i) => ({
      ...t,
      year: 1980 + i * 20,
    }));
    expect(build("extreme", lonely, 4).length).toBeGreaterThan(0);
  });

  it("scores a right show and rejects a wrong one", () => {
    const [round] = build("medium", pool(12, 3), 1);
    const spec = DIFFICULTIES.medium;

    const right = animeMode.judge({
      plan: round!,
      guess: round!.answer.series!,
      elapsedMs: 1_000,
      level: 0,
    });
    expect(right.correct).toBe(true);
    expect(right.gained).toBeGreaterThan(0);
    expect(right.final).toBe(true);

    const wrong = animeMode.judge({
      plan: round!,
      guess: "Some Other Show",
      elapsedMs: 1_000,
      level: 0,
    });
    expect(wrong.correct).toBe(false);
    expect(wrong.gained).toBe(0);
    expect(wrong.final).toBe(true);

    // The song title must never be accepted — the question is the show.
    expect(
      animeMode.judge({
        plan: round!,
        guess: round!.answer.title,
        elapsedMs: 1_000,
        level: 0,
      }).correct,
    ).toBe(false);

    expect(round!.clipMs).toBe(spec.clipMs);
    expect(round!.answerWindowMs).toBe(spec.answerWindowMs);
    expect(round!.stagesMs).toEqual([]);
  });

  it("names the winning tile on the plan", () => {
    for (const r of build("medium", pool(12, 3))) {
      expect(r.correctChoiceId).toBe(r.answer.series);
      expect(r.choices.some((c) => c.id === r.correctChoiceId)).toBe(true);
    }
  });
});
