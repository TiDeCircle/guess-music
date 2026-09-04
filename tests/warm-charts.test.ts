import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearItunesCache } from "@/server/itunes";
import { warmCharts } from "@/server/catalog";
import { PLAYLISTS } from "@/data/seeds";

/**
 * The boot warm-up.
 *
 * Every restart starts with an empty cache, and the chart feed is the one
 * upstream that is regularly slow — so without this the first player to pick a
 * "now" playlist is the one who waits for it, and the one who sees the error
 * when it times out.
 */

const chartCountries = [
  ...new Set(
    Object.values(PLAYLISTS)
      .map((p) => p.source)
      .filter((s) => s.kind === "chart")
      .map((s) => s.country),
  ),
];

/** Answers both halves of a chart fetch: the feed, then the id lookup. */
function stubApple() {
  const spy = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("marketingtools")) {
      return new Response(JSON.stringify({ feed: { results: [{ id: "1" }] } }));
    }
    return new Response(
      JSON.stringify({
        results: [
          {
            trackId: 1,
            trackName: "ความเชื่อ",
            artistName: "Bodyslam",
            artistId: 42,
            artworkUrl100: "https://example.test/100x100bb.jpg",
            previewUrl: "https://example.test/1.m4a",
            releaseDate: "2015-03-01",
            kind: "song",
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("warming the charts on boot", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches the chart for every country a playlist charts", async () => {
    const spy = stubApple();

    await warmCharts();

    const feedUrls = spy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("marketingtools"));
    expect(chartCountries.length).toBeGreaterThan(0);
    for (const country of chartCountries) {
      expect(feedUrls.some((u) => u.includes(`/${country}/`))).toBe(true);
    }
  });

  it("leaves the cache warm, so the first match pays nothing", async () => {
    const spy = stubApple();
    await warmCharts();
    const afterWarm = spy.mock.calls.length;

    await warmCharts();

    // The second pass is served from the cache the first one filled.
    expect(spy.mock.calls.length).toBe(afterWarm);
  });

  it("does not throw when Apple is down — a cold start is not a failed start", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );

    await expect(warmCharts()).resolves.toBeUndefined();
  });
});
