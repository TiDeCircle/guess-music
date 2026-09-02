import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearItunesCache, getFixedTracks } from "@/server/itunes";
import { ANIME_SERIES, ANIME_TRACKS, ANIME_TRACK_IDS } from "@/data/seeds/anime";
import { PLAYLISTS } from "@/data/seeds";
import { SERIES_CHOICE_COUNT } from "@/shared/modes/anime";

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

describe("the anime seed", () => {
  it("names a show for every track, and no id twice", () => {
    expect(ANIME_TRACKS.length).toBeGreaterThan(0);
    expect(new Set(ANIME_TRACK_IDS).size).toBe(ANIME_TRACK_IDS.length);
    for (const { id, series } of ANIME_TRACKS) {
      expect(id).toMatch(/^\d+$/);
      expect(series.length).toBeGreaterThan(0);
      expect(ANIME_SERIES[id]).toBe(series);
    }
  });

  // Below four shows the mode cannot fill a grid at all; twenty is what a
  // ten-round match needs before it starts repeating itself.
  it("holds enough distinct shows to play a full match", () => {
    const shows = new Set(ANIME_TRACKS.map((t) => t.series));
    expect(shows.size).toBeGreaterThanOrEqual(SERIES_CHOICE_COUNT);
    expect(shows.size).toBeGreaterThanOrEqual(20);
  });

  // Seasons and films folded onto one name is the whole reason a grid can
  // never offer two tiles that are both right.
  it("folds every season and film of a show onto one name", () => {
    for (const { series } of ANIME_TRACKS) {
      expect(series).not.toMatch(/\d+(st|nd|rd|th) Season|Season \d|Part \d|Movie:/);
    }
  });

  it("wires the seed into the playlist that uses it", () => {
    const { source, group } = PLAYLISTS["anime-all"];
    expect(group).toBe("anime");
    expect(source.kind).toBe("tracks");
    if (source.kind !== "tracks") throw new Error("unreachable");
    expect(source.trackIds).toEqual(ANIME_TRACK_IDS);
    expect(source.series).toEqual(ANIME_SERIES);
  });
});
