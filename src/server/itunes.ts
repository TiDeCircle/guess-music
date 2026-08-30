import type { Track } from "@/shared/types";
import { ARTIST_IDS } from "@/data/seeds/artist-ids";

/**
 * iTunes client. Two endpoints are used:
 *
 * - the Search API, for an artist's songs
 * - Apple's daily most-played RSS feed, for "what's charting right now"
 *
 * Neither needs a key or OAuth, but Apple asks for roughly 20 requests a
 * minute, and a handful of rooms starting matches at once would blow past that.
 * So everything is cached for a day and concurrency is kept low.
 */

const SEARCH_URL = "https://itunes.apple.com/search";
const LOOKUP_URL = "https://itunes.apple.com/lookup";
const CHART_URL = (country: string, limit: number) =>
  `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${limit}/songs.json`;

/** Apple's guidance is ~20 req/min; a day of caching keeps us far under it. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How deep to cache per artist. Deliberately deeper than any one Playlist
 * needs: an era Playlist filters by year before taking its share, and a shallow
 * cache would leave it with almost nothing to filter.
 */
const CACHE_DEPTH_PER_ARTIST = 25;

/** How many of those an unfiltered Playlist actually uses, popularity-first. */
const TRACKS_PER_ARTIST = 10;

/** Enough for same-artist decoys at extreme difficulty. */
const MIN_TRACKS_PER_ARTIST = 4;

/** The lookup endpoint takes many ids at once; this stays well inside it. */
const LOOKUP_BATCH = 150;

/**
 * How many songs to pull for a single artist. Artist mode draws every round and
 * every decoy from this one pool, so it needs to be deep.
 */
const ARTIST_LOOKUP_LIMIT = 60;

const REQUEST_TIMEOUT_MS = 8_000;

type CacheEntry<T> = { at: number; value: T };

const artistCache = new Map<string, CacheEntry<Track[]>>();
const chartCache = new Map<string, CacheEntry<Track[]>>();

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  kind?: string;
};

/**
 * Apple hands back a 100x100 thumbnail; the same URL serves any size if you
 * rewrite the dimensions, and the reveal screen shows the art large.
 */
function upscaleArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\./, "/600x600bb.");
}

function toTrack(r: ItunesResult): Track | null {
  // A result without a preview is useless to us — that is the whole game.
  if (!r.trackId || !r.trackName || !r.artistName || !r.previewUrl) return null;
  if (!r.artworkUrl100 || r.kind !== "song") return null;
  return {
    id: String(r.trackId),
    title: r.trackName,
    artist: r.artistName,
    artistId: r.artistId ?? 0,
    artworkUrl: upscaleArtwork(r.artworkUrl100),
    previewUrl: r.previewUrl,
    year: Number(String(r.releaseDate ?? "").slice(0, 4)) || 0,
  };
}

async function getJson<T>(url: string | URL): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "guess-music/0.1" },
  });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  // The search endpoint answers with content-type text/javascript, so res.json()
  // is fine but worth knowing if this ever starts failing oddly.
  return (await res.json()) as T;
}

/** Drop repeats of the same song arriving as different releases. */
function dedupeByTitle(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = `${t.title.trim().toLowerCase()}|${t.artist.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// ------------------------------------------------------------------- artists

async function searchArtist(artist: string, country: string): Promise<Track[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("term", artist);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", String(CACHE_DEPTH_PER_ARTIST * 2));

  const body = await getJson<{ results?: ItunesResult[] }>(url);
  const tracks: Track[] = [];
  for (const r of body.results ?? []) {
    const t = toTrack(r);
    if (!t) continue;
    // A search for "Bodyslam" also returns other artists' covers and features;
    // keeping only the searched artist is what makes same-artist decoys work.
    if (t.artist.toLowerCase() !== artist.toLowerCase()) continue;
    tracks.push(t);
  }
  return dedupeByTitle(tracks).slice(0, CACHE_DEPTH_PER_ARTIST);
}

/** Matching key for ARTIST_IDS: case, spaces and punctuation all ignored. */
const artistKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const ARTIST_ID_BY_KEY = new Map(
  Object.entries(ARTIST_IDS).map(([name, id]) => [artistKey(name), id]),
);

export function artistIdFor(name: string): number | undefined {
  return ARTIST_ID_BY_KEY.get(artistKey(name));
}

/**
 * Every song iTunes lists for an artist, by id.
 *
 * One request, and — unlike the Search API — one that does not get throttled
 * into 403s. This is the path artist mode runs on, and the path a named artist
 * takes once its id is known.
 */
export async function getArtistTracksById(
  artistId: number,
  country: string,
): Promise<Track[]> {
  const key = `${country}:id:${artistId}`;
  const hit = artistCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = new URL(LOOKUP_URL);
  url.searchParams.set("id", String(artistId));
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(ARTIST_LOOKUP_LIMIT));
  url.searchParams.set("country", country.toUpperCase());

  const body = await getJson<{ results?: ItunesResult[] }>(url);
  const tracks: Track[] = [];
  for (const r of body.results ?? []) {
    // The first result is the artist record itself, which toTrack rejects.
    const t = toTrack(r);
    if (!t) continue;
    // Apple also lists tracks where this artist is only a guest, and those are
    // credited to someone else. In artist mode every option is supposed to be
    // by the same act — a differing artist line under one tile would point
    // straight at the answer.
    if (t.artistId !== artistId) continue;
    tracks.push(t);
  }
  const deduped = dedupeByTitle(tracks);
  artistCache.set(key, { at: Date.now(), value: deduped });
  return deduped;
}

/**
 * An artist's songs, popularity-first, cached deep enough to filter later.
 *
 * Prefers the id when one is known, and falls back to searching by name when it
 * is not — which is what lets the id map be filled in an artist at a time
 * without any playlist going dark in the meantime.
 */
export async function getArtistTracks(
  artist: string,
  country: string,
): Promise<Track[]> {
  const id = artistIdFor(artist);
  if (id !== undefined) return getArtistTracksById(id, country);

  const key = `${country}:${artist.toLowerCase()}`;
  const hit = artistCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const tracks = await searchArtist(artist, country);
  artistCache.set(key, { at: Date.now(), value: tracks });
  return tracks;
}

export type YearWindow = { from?: number; to?: number };

function inWindow(track: Track, window?: YearWindow): boolean {
  if (!window) return true;
  // A track with no release date cannot be placed in an era, so an era
  // Playlist drops it rather than guessing.
  if (track.year === 0) return false;
  if (window.from !== undefined && track.year < window.from) return false;
  if (window.to !== undefined && track.year > window.to) return false;
  return true;
}

/**
 * Fetch several artists with a small concurrency window.
 *
 * A failing artist is dropped rather than failing the batch: one act missing
 * from the storefront should not stop a match from starting.
 */
export async function getTracksForArtists(
  artists: readonly string[],
  country: string,
  window?: YearWindow,
  concurrency = 3,
): Promise<Track[]> {
  const out: Track[] = [];
  const queue = artists.slice();

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      for (;;) {
        const artist = queue.shift();
        if (!artist) return;
        try {
          const all = await getArtistTracks(artist, country);
          // Filter first, then take: taking first would throw away the very
          // songs an era Playlist is looking for.
          const kept = all.filter((t) => inWindow(t, window)).slice(0, TRACKS_PER_ARTIST);
          // An artist with only one or two songs in range can't supply
          // same-artist decoys and skews the pool, so require a few.
          if (kept.length >= MIN_TRACKS_PER_ARTIST) out.push(...kept);
        } catch {
          // Dropped on purpose — see the doc comment.
        }
      }
    },
  );

  await Promise.all(workers);
  return out;
}

// -------------------------------------------------------------------- charts

/**
 * Fetch tracks by iTunes id.
 *
 * The lookup endpoint takes many ids per request, which is what makes a
 * hand-picked list of a hundred songs cost one round trip rather than a
 * hundred. Ids that no longer resolve are simply absent from the response;
 * the caller gets fewer tracks rather than an error.
 */
export async function lookupTracks(
  ids: readonly string[],
  country: string,
): Promise<Track[]> {
  const tracks: Track[] = [];
  for (let i = 0; i < ids.length; i += LOOKUP_BATCH) {
    const url = new URL(LOOKUP_URL);
    url.searchParams.set("id", ids.slice(i, i + LOOKUP_BATCH).join(","));
    url.searchParams.set("country", country.toUpperCase());
    url.searchParams.set("entity", "song");
    const body = await getJson<{ results?: ItunesResult[] }>(url);
    for (const r of body.results ?? []) {
      const t = toTrack(r);
      if (t) tracks.push(t);
    }
  }
  return tracks;
}

/** Cached list of hand-picked tracks, keyed the same way charts are. */
const fixedCache = new Map<string, CacheEntry<Track[]>>();

/**
 * A curated set of exact songs, resolved from ids.
 *
 * Unlike an artist search this cannot drift: the list names the recordings, so
 * what plays is what was chosen. Cached for a day like everything else.
 */
export async function getFixedTracks(
  key: string,
  ids: readonly string[],
  country: string,
): Promise<Track[]> {
  const hit = fixedCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const tracks = dedupeByTitle(await lookupTracks(ids, country));
  fixedCache.set(key, { at: Date.now(), value: tracks });
  return tracks;
}

type ChartFeed = { feed?: { results?: Array<{ id?: string }> } };

/**
 * Apple's most-played feed for a storefront.
 *
 * The feed itself carries no preview URLs — only ids — so the ids are handed
 * straight to the lookup endpoint, which returns the full records in a single
 * request per batch.
 */
export async function getChartTracks(
  country: string,
  limit: number,
): Promise<Track[]> {
  const key = `${country}:${limit}`;
  const hit = chartCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const feed = await getJson<ChartFeed>(CHART_URL(country, limit));
  const ids = (feed.feed?.results ?? [])
    .map((r) => r.id)
    .filter((id): id is string => Boolean(id));

  const deduped = dedupeByTitle(await lookupTracks(ids, country));
  chartCache.set(key, { at: Date.now(), value: deduped });
  return deduped;
}

/** Exposed for tests and for a warm-up on boot. */
export function clearItunesCache(): void {
  artistCache.clear();
  chartCache.clear();
  fixedCache.clear();
}

export const ITUNES_TUNING = {
  CACHE_TTL_MS,
  CACHE_DEPTH_PER_ARTIST,
  TRACKS_PER_ARTIST,
  MIN_TRACKS_PER_ARTIST,
};
