import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearItunesCache, getFixedTracks } from "@/server/itunes";

const result = (id: number, name: string) => ({
  trackId: id,
  trackName: name,
  artistName: "YOASOBI",
  artistId: 99,
  artworkUrl100: "https://example.test/100x100bb.jpg",
  previewUrl: `https://example.test/${id}.m4a`,
  releaseDate: "2021-07-02",
  kind: "song",
});

const respondWith = (...results: ReturnType<typeof result>[]) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ results }))),
  );

describe("getFixedTracks with a series map", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => vi.unstubAllGlobals());

  it("stamps the series named for each id", async () => {
    respondWith(result(1, "Gunjou"), result(2, "Monster"));

    const tracks = await getFixedTracks("t1", ["1", "2"], "TH", { "1": "BLUE PERIOD" });

    expect(tracks.find((t) => t.id === "1")?.series).toBe("BLUE PERIOD");
    // A track the map says nothing about stays plain, rather than guessing.
    expect(tracks.find((t) => t.id === "2")?.series).toBeUndefined();
  });

  it("leaves every track plain when no map is given", async () => {
    respondWith(result(1, "Gunjou"));

    const tracks = await getFixedTracks("t2", ["1"], "TH");

    expect(tracks[0]?.series).toBeUndefined();
  });
});
