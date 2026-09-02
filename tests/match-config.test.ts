import { describe, expect, it } from "vitest";
import {
  defaultSourceForMode,
  seriesPlaylistIds,
  sourceSuitsMode,
} from "@/shared/match-config";
import type { PlaylistId, SongSource } from "@/shared/types";

const playlist = (id: PlaylistId): SongSource => ({ kind: "playlist", playlist: id });
const artist: SongSource = { kind: "artist", artist: "Bodyslam" };

describe("mode and source compatibility", () => {
  it("lets every ordinary mode play anything", () => {
    for (const mode of ["quiz", "heardle", "heardle-coop"] as const) {
      expect(sourceSuitsMode(mode, playlist("thai-classic"))).toBe(true);
      expect(sourceSuitsMode(mode, artist)).toBe(true);
    }
  });

  it("refuses anime mode against a playlist with no shows in it", () => {
    expect(sourceSuitsMode("anime", playlist("thai-classic"))).toBe(false);
  });

  // An artist pool is one act's catalogue straight from iTunes and carries no
  // series at all, so it can never satisfy the mode however the act is chosen.
  it("refuses anime mode against any artist", () => {
    expect(sourceSuitsMode("anime", artist)).toBe(false);
  });

  it("accepts anime mode against every playlist that ships the mapping", () => {
    for (const id of seriesPlaylistIds()) {
      expect(sourceSuitsMode("anime", playlist(id))).toBe(true);
    }
  });

  it("leaves a source alone when the mode can already play it", () => {
    const current = playlist("thai-classic");
    expect(defaultSourceForMode("quiz", current)).toBe(current);
  });

  // This lands before the anime playlist does, so both branches are written
  // now and the assertion follows whichever is currently true. Once the
  // playlist ships the first branch is the live one, asserting the same thing.
  it("swaps in a workable source when one exists, and invents none when not", () => {
    const fixed = defaultSourceForMode("anime", playlist("thai-classic"));

    if (seriesPlaylistIds().length > 0) {
      expect(sourceSuitsMode("anime", fixed)).toBe(true);
      expect(defaultSourceForMode("anime", fixed)).toBe(fixed);
    } else {
      expect(fixed).toEqual(playlist("thai-classic"));
    }
  });
});
