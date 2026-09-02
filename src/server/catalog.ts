import type { SongSource, Track } from "@/shared/types";
import { PLAYLISTS } from "@/data/seeds";
import { isKnownArtist } from "@/data/seeds/artists";
import { shuffle, type Rng } from "@/shared/rng";
import {
  getArtistTracks,
  getChartTracks,
  getFixedTracks,
  getTracksForArtists,
} from "./itunes";

/**
 * How many artists to pull for one Match. Ten rounds need ten answers plus
 * three decoys each; a dozen artists at up to ten songs apiece leaves plenty of
 * slack for artists that come back thin or missing.
 */
const ARTISTS_PER_MATCH = 12;

/** Below this the round builder starts having to reuse tracks as decoys. */
const MIN_POOL = 40;

/** Second attempt pulls more artists before giving up. */
const FALLBACK_EXTRA_ARTISTS = 10;

/**
 * How deep to read a chart. Deeper than a Match needs, because a chart's top
 * songs are spread across many artists and the extra depth is what gives the
 * harder difficulties any same-artist decoys at all.
 */
const CHART_DEPTH = 100;

/** Ranges that identify a song as belonging to a language's own script. */
const SCRIPT_RANGES: Record<"thai" | "hangul", RegExp> = {
  thai: /[\u0E00-\u0E7F]/,
  hangul: /[\uAC00-\uD7AF\u1100-\u11FF]/,
};

/**
 * Narrow a chart to the songs actually in its playlist's language.
 *
 * Matching on the script of the title or artist catches most of it, but would
 * throw away native acts who title a song in English — the Thai chart has
 * `PUN — Living Death` sitting three rows from `PUN — ขอแค่นี้`. So any artist
 * with at least one native-script entry keeps all of theirs. What remains
 * dropped is the genuinely foreign material, which is the point.
 */
export function filterToScript(
  tracks: readonly Track[],
  script: "thai" | "hangul",
): Track[] {
  const re = SCRIPT_RANGES[script];
  const isNative = (t: Track) => re.test(t.title) || re.test(t.artist);

  const nativeArtists = new Set(
    tracks.filter(isNative).map((t) => t.artistId),
  );
  return tracks.filter((t) => isNative(t) || nativeArtists.has(t.artistId));
}

export class EmptyCatalogError extends Error {
  constructor(label: string) {
    super(`no playable tracks for ${label}`);
    this.name = "EmptyCatalogError";
  }
}

/**
 * An artist mode match needs enough songs that no round has to reuse one — ten
 * answers plus three decoys each, with the pool shared across all of them.
 */
const MIN_ARTIST_POOL = 14;

export class ThinArtistError extends Error {
  constructor(readonly artist: string) {
    super(`not enough songs for ${artist}`);
    this.name = "ThinArtistError";
  }
}

/**
 * Assemble the Track pool a Match draws from.
 *
 * For artist-backed Playlists the artist selection is randomised per Match, so
 * two matches in the same Room rarely see the same songs even before the
 * recently-played filter runs. Chart Playlists have no such freedom — the
 * chart is the chart — and rely on that filter alone.
 */
export async function buildPool(
  songSource: SongSource,
  rng: Rng,
): Promise<Track[]> {
  if (songSource.kind === "artist") return buildArtistPool(songSource.artist);

  const playlist = songSource.playlist;
  const { source } = PLAYLISTS[playlist];
  let tracks: Track[];

  if (source.kind === "chart") {
    const chart = await getChartTracks(source.country, CHART_DEPTH);
    tracks = source.script ? filterToScript(chart, source.script) : chart;
  } else if (source.kind === "tracks") {
    // No randomisation here: the list is the playlist. Variety between matches
    // comes from the recently-played filter in the round builder.
    tracks = await getFixedTracks(
      playlist,
      source.trackIds,
      source.country,
      source.series,
    );
  } else {
    const window = { from: source.yearFrom, to: source.yearTo };
    const ordered = shuffle(source.artists, rng);

    tracks = await getTracksForArtists(
      ordered.slice(0, ARTISTS_PER_MATCH),
      source.country,
      window,
    );

    if (tracks.length < MIN_POOL) {
      // Storefront gaps, a narrow era window, and network flakiness all land
      // here. Widen once.
      const more = ordered.slice(
        ARTISTS_PER_MATCH,
        ARTISTS_PER_MATCH + FALLBACK_EXTRA_ARTISTS,
      );
      if (more.length > 0) {
        tracks = tracks.concat(
          await getTracksForArtists(more, source.country, window),
        );
      }
    }
  }

  // The same song can arrive twice via different releases.
  const byId = new Map<string, Track>();
  for (const t of tracks) byId.set(t.id, t);
  const pool = [...byId.values()];

  if (pool.length === 0) throw new EmptyCatalogError(playlist);
  return pool;
}

/**
 * Every song by one artist.
 *
 * The whole Match comes from here, decoys included, which is what makes artist
 * mode hard: recognising the voice tells you nothing. A thin catalogue is
 * refused up front rather than producing a Match that repeats songs.
 */
async function buildArtistPool(artist: string): Promise<Track[]> {
  // The client may only name an artist the game ships, so a socket payload
  // cannot become an arbitrary query aimed at Apple.
  if (!isKnownArtist(artist)) throw new EmptyCatalogError(artist);

  const tracks = await getArtistTracks(artist, "TH");
  if (tracks.length === 0) throw new EmptyCatalogError(artist);
  if (tracks.length < MIN_ARTIST_POOL) throw new ThinArtistError(artist);
  return tracks;
}

export const CATALOG_TUNING = { ARTISTS_PER_MATCH, MIN_POOL, CHART_DEPTH };
