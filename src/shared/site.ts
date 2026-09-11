import type { PlaylistId } from "./types";

/**
 * The public face of the site: where it lives and how it describes itself.
 *
 * Absolute URLs have to come from here. Behind Cloudflare and Nginx the process
 * only ever sees 127.0.0.1, so there is no request to read the host from, and a
 * sitemap or a link preview with a relative address is no use to anyone.
 */
export const SITE_URL = "https://guess-music.madebytide.xyz";

export const SITE_NAME = "ทายเพลง — Guess Music";

/** Leads with the words people search for; the brand rides along first. */
export const SITE_TITLE = "ทายเพลง — เกมทายเพลงออนไลน์ เล่นกับเพื่อนแบบเรียลไทม์";

export const SITE_DESCRIPTION =
  "เกมทายเพลงออนไลน์ ฟังคลิปแล้วทายชื่อเพลง มีทั้งเพลงไทย สากล เคป็อป และอนิเมะ เล่นคนเดียวหรือสร้างห้องแข่งกับเพื่อนแบบเรียลไทม์ ฟรี ไม่ต้องสมัคร";

/**
 * Spread into every page's Open Graph block. A page that sets `openGraph`
 * replaces its parent's whole object rather than merging into it, so each one
 * has to carry these again.
 */
export const OPEN_GRAPH_BASE = {
  type: "website",
  siteName: SITE_NAME,
  locale: "th_TH",
} as const;

export const playlistPath = (id: PlaylistId) => `/playlist/${id}`;

/** The index of artist pages. */
export const ARTISTS_PATH = "/artist";

/**
 * An artist's name as a URL segment: "GAVIN:D" becomes "gavin-d", "Beyoncé"
 * becomes "beyonce". Unique across the shipped list — tests/seo.test.ts holds it
 * to that, since two artists on one slug would leave one of them without a page.
 */
export const artistSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const artistPath = (name: string) => `${ARTISTS_PATH}/${artistSlug(name)}`;

/**
 * The queries a public page's "play" link carries into the home screen, which
 * then sets that Song Source on the room the visitor creates.
 */
export const PRESET_PLAYLIST_PARAM = "playlist";
export const PRESET_ARTIST_PARAM = "artist";

export const playHref = (id: PlaylistId) => `/?${PRESET_PLAYLIST_PARAM}=${id}`;

export const artistPlayHref = (name: string) =>
  `/?${PRESET_ARTIST_PARAM}=${encodeURIComponent(name)}`;
