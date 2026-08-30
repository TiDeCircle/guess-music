import { describe, expect, it } from "vitest";
import { PLAYLISTS, PLAYLIST_GROUPS, PLAYLIST_IDS, DEFAULT_PLAYLIST } from "@/data/seeds";
import { filterToScript } from "@/server/catalog";
import { playlistSchema } from "@/shared/protocol";
import { STRINGS } from "@/client/i18n";
import type { Track } from "@/shared/types";

const track = (over: Partial<Track>): Track => ({
  id: "1",
  title: "Song",
  artist: "Artist",
  artistId: 1,
  artworkUrl: "https://example.test/a.jpg",
  previewUrl: "https://example.test/a.m4a",
  year: 2020,
  ...over,
});

describe("playlist registry", () => {
  it("lists every playlist exactly once across the groups", () => {
    expect(new Set(PLAYLIST_IDS).size).toBe(PLAYLIST_IDS.length);
    expect(PLAYLIST_IDS.length).toBe(Object.keys(PLAYLISTS).length);
  });

  it("puts each playlist in the group it says it belongs to", () => {
    for (const { group, ids } of PLAYLIST_GROUPS) {
      for (const id of ids) expect(PLAYLISTS[id].group).toBe(group);
    }
  });

  // The wire schema is what actually guards the server, so a playlist that
  // exists in the registry but not in the schema would be unselectable.
  it("accepts every registered playlist over the wire, and nothing else", () => {
    for (const id of PLAYLIST_IDS) {
      expect(playlistSchema.safeParse(id).success).toBe(true);
    }
    expect(playlistSchema.safeParse("thai").success).toBe(false);
    expect(playlistSchema.safeParse("thai-1980s").success).toBe(false);
  });

  it("has a name in both languages for every playlist", () => {
    for (const id of PLAYLIST_IDS) {
      const entry = STRINGS[`playlist.${id}` as keyof typeof STRINGS];
      expect(entry, `missing copy for ${id}`).toBeDefined();
      expect(entry.th.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
    }
  });

  it("defaults to a playlist that exists", () => {
    expect(PLAYLIST_IDS).toContain(DEFAULT_PLAYLIST);
  });

  it("gives every era playlist a sane year window", () => {
    for (const id of PLAYLIST_IDS) {
      const source = PLAYLISTS[id].source;
      if (source.kind !== "artists") continue;
      if (source.yearFrom !== undefined && source.yearTo !== undefined) {
        expect(source.yearFrom).toBeLessThan(source.yearTo);
      }
      expect(source.artists.length).toBeGreaterThan(0);
      expect(new Set(source.artists).size).toBe(source.artists.length);
    }
  });
});

describe("filterToScript", () => {
  it("keeps songs titled in the script", () => {
    const kept = filterToScript(
      [track({ id: "a", title: "ขอแค่นี้", artistId: 1 })],
      "thai",
    );
    expect(kept.map((t) => t.id)).toEqual(["a"]);
  });

  it("drops a foreign song outright", () => {
    const kept = filterToScript(
      [
        track({ id: "a", title: "ขอแค่นี้", artist: "PUN", artistId: 1 }),
        track({ id: "b", title: "hate that i made you love me", artist: "Ariana Grande", artistId: 2 }),
      ],
      "thai",
    );
    expect(kept.map((t) => t.id)).toEqual(["a"]);
  });

  // The case the naive filter gets wrong: a Thai act's English-titled single.
  it("keeps an English-titled song by an artist who charts in the script too", () => {
    const kept = filterToScript(
      [
        track({ id: "a", title: "ขอแค่นี้", artist: "PUN", artistId: 1 }),
        track({ id: "b", title: "Living Death", artist: "PUN", artistId: 1 }),
        track({ id: "c", title: "Sunflower", artist: "Post Malone", artistId: 9 }),
      ],
      "thai",
    );
    expect(kept.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("matches on the artist name when the title is in another script", () => {
    const kept = filterToScript(
      [track({ id: "a", title: "Lies", artist: "อะตอม ชนกันต์", artistId: 1 })],
      "thai",
    );
    expect(kept.map((t) => t.id)).toEqual(["a"]);
  });

  it("recognises hangul separately from thai", () => {
    const rows = [
      track({ id: "k", title: "어떻게 이별까지", artist: "악뮤", artistId: 1 }),
      track({ id: "t", title: "ขอแค่นี้", artist: "PUN", artistId: 2 }),
    ];
    expect(filterToScript(rows, "hangul").map((t) => t.id)).toEqual(["k"]);
    expect(filterToScript(rows, "thai").map((t) => t.id)).toEqual(["t"]);
  });

  it("returns nothing rather than everything when no song matches", () => {
    const kept = filterToScript([track({ id: "a", title: "Sunflower" })], "thai");
    expect(kept).toEqual([]);
  });
});
