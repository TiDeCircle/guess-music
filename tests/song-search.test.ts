import { describe, expect, it } from "vitest";
import { searchSongs, type SongEntry } from "@/client/songIndex";

/**
 * The answer box has two jobs that pull against each other: never let one
 * artist fill the list, and never hide the song somebody just typed the name
 * of. Getting the first one right broke the second — a per-artist cap applied
 * to exact matches meant an act with a Live, a JP and an Unplugged version of
 * one song used up its allowance before the version you meant, and 11% of the
 * shipped catalogue could not be found by typing its own title.
 */
const flatten = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function entry(title: string, artist: string): SongEntry {
  const bare = flatten(title);
  const core = flatten(
    title.replace(/[([{][^)\]}]*[)\]}]/gu, " ").replace(/\s[-–—]\s.*$/u, " "),
  );
  return { title, artist, search: `${bare} ${flatten(artist)}`, exact: [bare, core || bare] };
}

const INDEX: SongEntry[] = [
  entry("แสงสุดท้าย", "Bodyslam"),
  entry("แสงสุดท้าย (22Bullets Remix)", "Bodyslam"),
  entry("แสงสุดท้าย (นั่งเล่น Version)", "Bodyslam"),
  entry("แสงสวรรค์", "Bodyslam"),
  entry("แสงแรก", "Bodyslam"),
  entry("แสงสุดท้าย", "Bodyslam & Twopee"),
  entry("แสงจันทร์", "Moderndog"),
  entry("แสงไฟไม่จำเป็น", "Lomosonic"),
  entry("ฝุ่น", "Big Ass"),
  entry("ฝน", "Clash"),
  entry("จูบ", "KALA"),
  entry("จีบ (Live Session)", "Namm Ronnadet"),
];

const titles = (q: string) => searchSongs(INDEX, q).map((s) => `${s.title} — ${s.artist}`);

describe("the answer box search", () => {
  it("finds a song by its own title, whichever version it is", () => {
    // The bug this whole tier system exists for: every one of these is the
    // right answer to somebody's round.
    for (const t of [
      "แสงสุดท้าย — Bodyslam",
      "แสงสุดท้าย (22Bullets Remix) — Bodyslam",
      "แสงสุดท้าย (นั่งเล่น Version) — Bodyslam",
      "แสงสุดท้าย — Bodyslam & Twopee",
    ]) {
      expect(titles("แสงสุดท้าย")).toContain(t);
    }
  });

  it("finds a song whose printed title carries a suffix", () => {
    expect(titles("จีบ")).toContain("จีบ (Live Session) — Namm Ronnadet");
  });

  it("still spreads a loose query across artists", () => {
    // Typing three characters must not hand back five songs by one band.
    const artists = searchSongs(INDEX, "แสง").map((s) => s.artist);
    expect(new Set(artists).size).toBeGreaterThan(2);
    for (const a of new Set(artists)) {
      expect(artists.filter((x) => x === a).length).toBeLessThanOrEqual(2);
    }
  });

  it("is forgiving about Thai marks, since the list is a typing aid", () => {
    // Grading keeps ฝุ่น and ฝน apart; the search offers both and lets the
    // player pick, which is the right split of strictness.
    expect(titles("ฝน")).toEqual(expect.arrayContaining(["ฝน — Clash"]));
    expect(titles("ฝุน").length).toBeGreaterThan(0);
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(searchSongs(INDEX, "")).toEqual([]);
    expect(searchSongs(INDEX, "   ")).toEqual([]);
    expect(searchSongs(INDEX, "!!!")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(searchSongs(INDEX, "แสง", 3)).toHaveLength(3);
  });

  it("matches on the artist too, so a band name narrows the list", () => {
    const found = searchSongs(INDEX, "moderndog");
    expect(found).toHaveLength(1);
    expect(found[0]!.title).toBe("แสงจันทร์");
  });
});
