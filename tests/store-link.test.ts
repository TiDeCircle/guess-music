import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearItunesCache, getFixedTracks } from "@/server/itunes";

/**
 * Apple's terms let us play a Preview only next to a way to buy or stream the
 * song, so every Track has to carry its store link through to the reveal.
 */

const base = {
  trackId: 7,
  trackName: "ความเชื่อ",
  artistName: "Bodyslam",
  artistId: 42,
  artworkUrl100: "https://example.test/100x100bb.jpg",
  previewUrl: "https://example.test/7.m4a",
  releaseDate: "2015-03-01",
  kind: "song",
};

function respondWith(result: object) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [result] }))));
}

describe("store link", () => {
  beforeEach(() => clearItunesCache());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the trackViewUrl Apple hands back", async () => {
    const url = "https://music.apple.com/th/album/x/1?i=7&uo=4";
    respondWith({ ...base, trackViewUrl: url });
    const [track] = await getFixedTracks("store-a", ["7"], "TH");
    expect(track?.storeUrl).toBe(url);
  });

  it("leaves it unset when Apple sends none, rather than inventing one", async () => {
    respondWith(base);
    const [track] = await getFixedTracks("store-b", ["7"], "TH");
    expect(track?.storeUrl).toBeUndefined();
  });
});
