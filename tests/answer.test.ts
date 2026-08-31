import { describe, expect, it } from "vitest";
import { matchesTitle, titleKeys } from "@/shared/answer";

/**
 * These are real titles from the shipped playlists. The failure mode being
 * guarded against is one-directional: telling somebody who knows the song that
 * they are wrong is far worse than accepting a title that was close enough.
 */
describe("typed answers", () => {
  it("accepts the title exactly as printed", () => {
    expect(matchesTitle("แสงสุดท้าย", "แสงสุดท้าย")).toBe(true);
  });

  it("accepts the title without its production suffix", () => {
    // Over half the catalogue carries one of these, and nobody types them.
    expect(matchesTitle("ผลข้างเคียง", "ผลข้างเคียง (Love Effects) [feat. BILLKIN]")).toBe(true);
    expect(matchesTitle("ได้แค่เดินมาส่ง", "ได้แค่เดินมาส่ง (The Last Walk) [feat. BLVCKHEART]")).toBe(true);
    expect(matchesTitle("Sunflower", 'Sunflower (Spider-Man: Into the Spider-Verse)')).toBe(true);
  });

  it("accepts it with the suffix too, since that is what the list offers", () => {
    const printed = "ผลข้างเคียง (Love Effects) [feat. BILLKIN]";
    expect(matchesTitle(printed, printed)).toBe(true);
  });

  it("ignores a dash suffix, which is how iTunes writes versions", () => {
    expect(matchesTitle("Blinding Lights", "Blinding Lights - Single Version")).toBe(true);
  });

  it("does not care about spacing, which Thai does not fix", () => {
    // Thai is written without spaces, so where a title breaks across words is
    // taste rather than spelling.
    expect(matchesTitle("ไม่ เป็นไร", "ไม่เป็นไร")).toBe(true);
    expect(matchesTitle("ไม่เป็นไร", "ไม่ เป็นไร")).toBe(true);
  });

  it("ignores case and punctuation", () => {
    expect(matchesTitle("get you out", "Get You Out [JOOX Exclusive]")).toBe(true);
    expect(matchesTitle("ดูดี!!", "ดูดี")).toBe(true);
  });

  it("still refuses a different song", () => {
    expect(matchesTitle("แสงสุดท้าย", "ทุกวันพรุ่งนี้")).toBe(false);
    expect(matchesTitle("Sunflower", "Sunrise")).toBe(false);
  });

  it("refuses a prefix of the right answer", () => {
    // Generous is one thing; "แ" must not win a round.
    expect(matchesTitle("แสง", "แสงสุดท้าย")).toBe(false);
    expect(matchesTitle("Sun", "Sunflower")).toBe(false);
  });

  it("refuses empty and punctuation-only guesses", () => {
    // An empty key would otherwise match every title there is.
    expect(matchesTitle("", "แสงสุดท้าย")).toBe(false);
    expect(matchesTitle("   ", "แสงสุดท้าย")).toBe(false);
    expect(matchesTitle("!!!", "แสงสุดท้าย")).toBe(false);
  });

  it("never produces an empty key, even for a title that is all suffix", () => {
    const keys = titleKeys("(Reprise)");
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k.length).toBeGreaterThan(0);
    // And that title still cannot be won with nothing.
    expect(matchesTitle("", "(Reprise)")).toBe(false);
  });

  it("keeps Thai tone marks apart", () => {
    // Stripping diacritics would merge words that genuinely differ.
    expect(matchesTitle("เขา", "เข้า")).toBe(false);
  });
});
