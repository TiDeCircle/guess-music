import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { readPresetSource } from "@/client/preset";
import { INDEXABLE_ARTISTS, artistBySlug, artistSongs } from "@/data/artist-pages";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { PLAYLIST_IDS } from "@/data/seeds";
import { ARTISTS } from "@/data/seeds/artists";
import { MIN_ARTIST_POOL } from "@/server/catalog";
import { shareMessage, shareUrl } from "@/shared/share";
import {
  ARTISTS_PATH,
  SITE_URL,
  artistPath,
  artistPlayHref,
  artistSlug,
  playHref,
  playlistPath,
} from "@/shared/site";

const searchOf = (href: string) => new URL(href, SITE_URL).search;

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists home, every playlist, the artist index and every indexable artist, once each", () => {
    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}${ARTISTS_PATH}`);
    for (const id of PLAYLIST_IDS) expect(urls).toContain(`${SITE_URL}${playlistPath(id)}`);
    for (const a of INDEXABLE_ARTISTS) expect(urls).toContain(`${SITE_URL}${artistPath(a.name)}`);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBe(2 + PLAYLIST_IDS.length + INDEXABLE_ARTISTS.length);
  });

  it("gives whole URLs on the public host", () => {
    for (const url of urls) expect(url.startsWith(`${SITE_URL}/`)).toBe(true);
  });
});

describe("robots", () => {
  it("points at the sitemap and leaves every page open", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    const blocked = [result.rules].flat().flatMap((rule) => [rule.disallow ?? []].flat());
    for (const path of ["/", playlistPath("thai-90s"), ARTISTS_PATH, artistPath("Bodyslam")]) {
      expect(blocked.some((prefix) => path.startsWith(prefix))).toBe(false);
    }
  });
});

describe("playlist page copy", () => {
  it("heads every playlist with the phrase people search for", () => {
    for (const id of PLAYLIST_IDS) {
      expect(PLAYLIST_PAGES[id].heading.startsWith("ทายเพลง")).toBe(true);
      expect(PLAYLIST_PAGES[id].blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("artist pages", () => {
  it("gives every shipped artist a slug of its own", () => {
    const slugs = ARTISTS.map((a) => artistSlug(a.name));
    expect(slugs.every((slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ARTISTS) expect(artistBySlug(artistSlug(a.name))).toBe(a);
  });

  // An indexed page promises a quiz that starts; artist mode refuses a thinner
  // catalogue than this.
  it("indexes only artists with enough songs for artist mode to start", () => {
    expect(INDEXABLE_ARTISTS.length).toBeGreaterThan(100);
    for (const a of INDEXABLE_ARTISTS) {
      expect(artistSongs(a.name).length).toBeGreaterThanOrEqual(MIN_ARTIST_POOL);
    }
  });
});

describe("readPresetSource", () => {
  it("reads back the link every playlist page makes", () => {
    for (const id of PLAYLIST_IDS) {
      expect(readPresetSource(searchOf(playHref(id)))).toEqual({ kind: "playlist", playlist: id });
    }
  });

  it("reads back the link every artist page makes, odd characters and all", () => {
    for (const { name } of ARTISTS) {
      expect(readPresetSource(searchOf(artistPlayHref(name)))).toEqual({ kind: "artist", artist: name });
    }
  });

  it("ignores anything the server would refuse", () => {
    expect(readPresetSource("")).toBeNull();
    expect(readPresetSource("?code=ABCD")).toBeNull();
    expect(readPresetSource("?playlist=thai-1980s")).toBeNull();
    expect(readPresetSource("?artist=Somebody%20Else")).toBeNull();
  });
});

describe("sharing a result", () => {
  it("links the public page for what was played", () => {
    expect(shareUrl({ kind: "playlist", playlist: "thai-90s" })).toBe(
      `${SITE_URL}${playlistPath("thai-90s")}`,
    );
    expect(shareUrl({ kind: "artist", artist: "GAVIN:D" })).toBe(`${SITE_URL}/artist/gavin-d`);
  });

  it("says what was played and how it went", () => {
    const solo = shareMessage({
      lang: "th",
      source: { kind: "playlist", playlist: "thai-90s" },
      correct: 8,
      total: 10,
      score: 1340,
      team: false,
    });
    expect(solo).toContain("ทายเพลงไทยยุค 90");
    expect(solo).toContain("8/10");
    expect(solo).toContain("1340");

    const team = shareMessage({
      lang: "th",
      source: { kind: "artist", artist: "Bodyslam" },
      correct: 6,
      total: 10,
      score: 900,
      team: true,
    });
    expect(team).toContain("ทีมเรา");
    expect(team).toContain("Bodyslam");
    expect(team).not.toContain("900");
  });
});
