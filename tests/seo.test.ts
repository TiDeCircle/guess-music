import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PLAYLIST_IDS } from "@/data/seeds";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { readPresetPlaylist } from "@/client/presetPlaylist";
import { SITE_URL, playHref, playlistPath } from "@/shared/site";

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists the home page and every playlist page, once each", () => {
    expect(urls).toContain(`${SITE_URL}/`);
    for (const id of PLAYLIST_IDS) expect(urls).toContain(`${SITE_URL}${playlistPath(id)}`);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBe(PLAYLIST_IDS.length + 1);
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
    for (const path of ["/", playlistPath("thai-90s")]) {
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

describe("readPresetPlaylist", () => {
  it("reads back the link every playlist page makes", () => {
    for (const id of PLAYLIST_IDS) {
      expect(readPresetPlaylist(new URL(playHref(id), SITE_URL).search)).toBe(id);
    }
  });

  it("ignores a missing or unknown playlist", () => {
    expect(readPresetPlaylist("")).toBeNull();
    expect(readPresetPlaylist("?code=ABCD")).toBeNull();
    expect(readPresetPlaylist("?playlist=thai-1980s")).toBeNull();
  });
});
