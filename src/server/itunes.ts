import type { Track } from "@/shared/types";

/**
 * iTunes Search API client.
 *
 * No key, no OAuth — but Apple asks for roughly 20 requests a minute, and a
 * handful of rooms starting matches at once would blow past that easily. So
 * every artist lookup is cached for a day and concurrency is kept low.
 */

const SEARCH_URL = "https://itunes.apple.com/search";

/** Apple's guidance is ~20 req/min; a day of caching keeps us far under it. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** How many songs to keep per artist. iTunes returns them popularity-first. */
const TRACKS_PER_ARTIST = 10;

/** Enough for same-artist decoys at extreme difficulty. */
const MIN_TRACKS_PER_ARTIST = 4;

const REQUEST_TIMEOUT_MS = 8_000;

type CacheEntry = { at: number; tracks: Track[] };

const cache = new Map<string, CacheEntry>();

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  artworkUrl100?: string;
  previewUrl?: string;
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
  };
}

async function searchArtist(artist: string, country: string): Promise<Track[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("term", artist);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", String(TRACKS_PER_ARTIST * 2));

  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "guess-music/0.1" },
  });
  if (!res.ok) throw new Error(`iTunes ${res.status} for ${artist}`);

  // The endpoint answers with content-type text/javascript, so res.json()
  // is fine but worth knowing if this ever starts failing oddly.
  const body = (await res.json()) as { results?: ItunesResult[] };
  const results = body.results ?? [];

  const tracks: Track[] = [];
  const seenTitles = new Set<string>();
  for (const r of results) {
    const t = toTrack(r);
    if (!t) continue;
    // A search for "Bodyslam" also returns other artists' covers and features;
    // keeping only the searched artist is what makes same-artist decoys work.
    if (t.artist.toLowerCase() !== artist.toLowerCase()) continue;
    const key = t.title.trim().toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    tracks.push(t);
    if (tracks.length >= TRACKS_PER_ARTIST) break;
  }
  return tracks;
}

export async function getArtistTracks(
  artist: string,
  country: string,
): Promise<Track[]> {
  const key = `${country}:${artist.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tracks;

  const tracks = await searchArtist(artist, country);
  cache.set(key, { at: Date.now(), tracks });
  return tracks;
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
  concurrency = 3,
): Promise<Track[]> {
  const out: Track[] = [];
  const queue = artists.slice();

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const artist = queue.shift();
      if (!artist) return;
      try {
        const tracks = await getArtistTracks(artist, country);
        // An artist with only one or two songs can't supply same-artist decoys
        // and skews the pool, so require a few.
        if (tracks.length >= MIN_TRACKS_PER_ARTIST) out.push(...tracks);
      } catch {
        // Dropped on purpose — see the doc comment.
      }
    }
  });

  await Promise.all(workers);
  return out;
}

/** Exposed for tests and for a warm-up on boot. */
export function clearItunesCache(): void {
  cache.clear();
}

export const ITUNES_TUNING = {
  CACHE_TTL_MS,
  TRACKS_PER_ARTIST,
  MIN_TRACKS_PER_ARTIST,
};
