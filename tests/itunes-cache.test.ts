import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ITUNES_TUNING, clearItunesCache, getFixedTracks } from "@/server/itunes";

/**
 * How the iTunes cache behaves when several Rooms want the same songs at once,
 * and when Apple does not answer.
 *
 * These are load and outage properties, not parsing ones: what matters is how
 * many requests leave this process and whether a Match can still start when the
 * request that would refresh the cache fails.
 */

const result = (id: number, name: string) => ({
  trackId: id,
  trackName: name,
  artistName: "Bodyslam",
  artistId: 42,
  artworkUrl100: "https://example.test/100x100bb.jpg",
  previewUrl: `https://example.test/${id}.m4a`,
  releaseDate: "2015-03-01",
  kind: "song",
});

/** A fetch that always answers, handing back the spy so calls can be counted. */
function respondWith(...results: ReturnType<typeof result>[]) {
  const spy = vi.fn(async () => new Response(JSON.stringify({ results })));
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** A fetch that fails the way a timeout or a 5xx does. */
function failWith(message: string) {
  const spy = vi.fn(async () => {
    throw new Error(message);
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Move the clock past the cache TTL without touching timers. */
function expireCache() {
  const at = Date.now() + ITUNES_TUNING.CACHE_TTL_MS + 60_000;
  vi.spyOn(Date, "now").mockReturnValue(at);
}

describe("iTunes cache under concurrent misses", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("collapses concurrent misses for the same key into one request", async () => {
    const fetchSpy = respondWith(result(1, "ความเชื่อ"));

    // Ten Rooms pressing start on the same Playlist in the same moment.
    const pools = await Promise.all(
      Array.from({ length: 10 }, () => getFixedTracks("buzz", ["1"], "TH")),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Every caller still gets the songs, not just the one that did the work.
    for (const pool of pools) expect(pool.map((t) => t.id)).toEqual(["1"]);
  });

  it("fetches once more for a different key", async () => {
    const fetchSpy = respondWith(result(1, "ความเชื่อ"));

    await Promise.all([
      getFixedTracks("buzz", ["1"], "TH"),
      getFixedTracks("classic", ["1"], "TH"),
    ]);

    // Sharing an in-flight request must not mean sharing the wrong answer.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure, so the next Match tries again", async () => {
    failWith("timeout");
    await expect(getFixedTracks("buzz", ["1"], "TH")).rejects.toThrow("timeout");

    const fetchSpy = respondWith(result(1, "ความเชื่อ"));
    const pool = await getFixedTracks("buzz", ["1"], "TH");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(pool.map((t) => t.id)).toEqual(["1"]);
  });

  it("serves a warm cache without asking Apple again", async () => {
    const fetchSpy = respondWith(result(1, "ความเชื่อ"));

    await getFixedTracks("buzz", ["1"], "TH");
    await getFixedTracks("buzz", ["1"], "TH");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("iTunes cache when a refresh fails", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to the stale songs rather than failing the Match", async () => {
    respondWith(result(1, "ความเชื่อ"));
    await getFixedTracks("buzz", ["1"], "TH");

    expireCache();
    failWith("timeout");

    // Yesterday's chart is a better answer than no Match at all.
    const pool = await getFixedTracks("buzz", ["1"], "TH");
    expect(pool.map((t) => t.id)).toEqual(["1"]);
  });

  it("still throws when a refresh fails and there is nothing stale to serve", async () => {
    failWith("timeout");

    await expect(getFixedTracks("cold", ["1"], "TH")).rejects.toThrow("timeout");
  });
});

describe("iTunes requests that fail once", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Fails the first n calls, then answers. */
  function failThenRespond(failures: number) {
    let calls = 0;
    const spy = vi.fn(async () => {
      calls += 1;
      if (calls <= failures) throw new Error("timeout");
      return new Response(JSON.stringify({ results: [result(1, "ความเชื่อ")] }));
    });
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  it("tries once more, because the retry is usually the one that lands", async () => {
    const fetchSpy = failThenRespond(1);

    const pool = await getFixedTracks("buzz", ["1"], "TH");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(pool.map((t) => t.id)).toEqual(["1"]);
  });

  it("gives up rather than hammering Apple past the second attempt", async () => {
    const fetchSpy = failThenRespond(99);

    await expect(getFixedTracks("buzz", ["1"], "TH")).rejects.toThrow("timeout");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404, which will say the same thing next time", async () => {
    const spy = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", spy);

    await expect(getFixedTracks("buzz", ["1"], "TH")).rejects.toThrow(/404/);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does retry a 503, which might not", async () => {
    let calls = 0;
    const spy = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify({ results: [result(1, "ความเชื่อ")] }));
    });
    vi.stubGlobal("fetch", spy);

    const pool = await getFixedTracks("buzz", ["1"], "TH");

    expect(spy).toHaveBeenCalledTimes(2);
    expect(pool.map((t) => t.id)).toEqual(["1"]);
  });
});
