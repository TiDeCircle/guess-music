import { describe, expect, it } from "vitest";
import { quizMode, CHOICE_COUNT } from "@/shared/modes/quiz";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import type { Track } from "@/shared/types";

/** A pool of `artists` acts with `per` songs each. */
function pool(artists: number, per: number): Track[] {
  const out: Track[] = [];
  for (let a = 0; a < artists; a++) {
    for (let s = 0; s < per; s++) {
      out.push({
        id: `${a}-${s}`,
        title: `Song ${a}-${s}`,
        artist: `Artist ${a}`,
        artistId: a,
        artworkUrl: "https://example.test/art.jpg",
        previewUrl: `https://example.test/${a}-${s}.m4a`,
        year: 2000 + s,
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
  quizMode.buildRounds({
    pool: tracks,
    count,
    difficulty: DIFFICULTIES[difficulty],
    rng: makeRng(1234),
    exclude,
  });

describe("quiz rounds", () => {
  it("always offers exactly four choices, one of them right", () => {
    for (const rounds of [build("easy", pool(12, 6)), build("extreme", pool(12, 6))]) {
      expect(rounds).toHaveLength(10);
      for (const r of rounds) {
        expect(r.choices).toHaveLength(CHOICE_COUNT);
        expect(r.choices.filter((c) => c.id === r.answer.id)).toHaveLength(1);
      }
    }
  });

  it("never repeats an answer within a match", () => {
    const rounds = build("medium", pool(12, 6));
    const ids = rounds.map((r) => r.answer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never shows the same option twice in one round", () => {
    for (const r of build("hard", pool(12, 6))) {
      expect(new Set(r.choices.map((c) => c.id)).size).toBe(CHOICE_COUNT);
    }
  });

  it("carries the difficulty's timing and multiplier onto every round", () => {
    for (const r of build("extreme", pool(12, 6))) {
      expect(r.clipMs).toBe(DIFFICULTIES.extreme.clipMs);
      expect(r.answerWindowMs).toBe(DIFFICULTIES.extreme.answerWindowMs);
      expect(r.multiplier).toBe(DIFFICULTIES.extreme.multiplier);
    }
  });

  describe("decoy strategy", () => {
    // The choices no longer carry an artist — that was handing the answer to
    // anyone who recognised the voice — so who sang what is resolved back
    // through the pool the round was built from.
    const sameArtistDecoys = (rounds: ReturnType<typeof build>, tracks: Track[]) => {
      const artistOf = new Map(tracks.map((t) => [t.id, t.artist]));
      return rounds.map(
        (r) =>
          r.choices.filter(
            (c) => c.id !== r.answer.id && artistOf.get(c.id) === r.answer.artist,
          ).length,
      );
    };

    it("keeps every wrong option by a different artist on easy", () => {
      for (const n of sameArtistDecoys(build("easy", pool(12, 6)), pool(12, 6))) {
        expect(n).toBe(0);
      }
    });

    it("puts two same-artist decoys in every extreme round", () => {
      for (const n of sameArtistDecoys(build("extreme", pool(12, 6)), pool(12, 6))) {
        expect(n).toBe(2);
      }
    });

    it("puts exactly one same-artist decoy in a hard round", () => {
      for (const n of sameArtistDecoys(build("hard", pool(12, 6)), pool(12, 6))) {
        expect(n).toBe(1);
      }
    });

    it("falls back to different-artist decoys when the artist is thin", () => {
      // Two songs per artist: extreme wants two same-artist decoys and can only
      // ever get one. The round must still be playable.
      const rounds = build("extreme", pool(12, 2));
      expect(rounds.length).toBeGreaterThan(0);
      for (const r of rounds) expect(r.choices).toHaveLength(CHOICE_COUNT);
    });
  });

  it("avoids recently played answers when the pool allows", () => {
    const tracks = pool(12, 6);
    const stale = new Set(build("medium", tracks).map((r) => r.answer.id));
    const next = build("medium", tracks, 10, stale);
    for (const r of next) expect(stale.has(r.answer.id)).toBe(false);
  });

  it("ignores the recent list rather than failing when the pool is small", () => {
    const tracks = pool(4, 4);
    const excludeAll = new Set(tracks.map((t) => t.id));
    const rounds = build("easy", tracks, 5, excludeAll);
    expect(rounds.length).toBeGreaterThan(0);
  });

  it("never treats two releases of the same song as different options", () => {
    const tracks = pool(12, 6);
    // A duplicate release: new id, identical title and artist.
    tracks.push({ ...tracks[0]!, id: "dupe" });
    for (const r of build("medium", tracks)) {
      const titles = r.choices.map((c) => c.title.trim().toLowerCase());
      expect(new Set(titles).size).toBe(CHOICE_COUNT);
    }
  });

  /**
   * The tile shows a title and nothing else, so two options that share a title
   * are two identical tiles — one of which is scored wrong. Before the artist
   * came off they were told apart by the line underneath; now nothing does, and
   * the round has to refuse to build them in the first place.
   */
  it("never offers the same title twice, even by different artists", () => {
    // Every act covers every song, so a collision check that compares the
    // artist as well as the title has a dozen ways to pair two identical tiles
    // in one round, and a title-only one has none. Six distinct titles is more
    // than the four a round needs, so this stays buildable either way — it is
    // the labels that separate a pass from a fail, not the round count.
    const covers = pool(12, 6).map((t, i) => ({
      ...t,
      title: `Song ${i % 6}`,
    }));
    const rounds = build("medium", covers);
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) {
      const titles = r.choices.map((c) => c.title.trim().toLowerCase());
      expect(new Set(titles).size).toBe(CHOICE_COUNT);
    }
  });

  it("puts no artist on the wire with the options at all", () => {
    for (const r of build("medium", pool(12, 6))) {
      for (const c of r.choices) {
        expect(Object.keys(c).sort()).toEqual(["id", "title"]);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const tracks = pool(12, 6);
    const a = build("medium", tracks).map((r) => r.answer.id);
    const b = build("medium", tracks).map((r) => r.answer.id);
    expect(a).toEqual(b);
  });
});
