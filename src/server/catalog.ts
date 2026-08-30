import type { CategoryId, Track } from "@/shared/types";
import { CATEGORIES } from "@/data/seeds";
import { shuffle, type Rng } from "@/shared/rng";
import { getTracksForArtists } from "./itunes";

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

export class EmptyCatalogError extends Error {
  constructor(category: CategoryId) {
    super(`no playable tracks for category ${category}`);
    this.name = "EmptyCatalogError";
  }
}

/**
 * Assemble the Track pool a Match draws from.
 *
 * Which artists get picked is randomised per Match, so two matches in the same
 * Room rarely see the same songs even before the recently-played filter runs.
 */
export async function buildPool(
  category: CategoryId,
  rng: Rng,
): Promise<Track[]> {
  const def = CATEGORIES[category];
  const ordered = shuffle(def.artists, rng);

  const first = ordered.slice(0, ARTISTS_PER_MATCH);
  let tracks = await getTracksForArtists(first, def.country);

  if (tracks.length < MIN_POOL) {
    // Storefront gaps and network flakiness both land here. Widen once.
    const more = ordered.slice(
      ARTISTS_PER_MATCH,
      ARTISTS_PER_MATCH + FALLBACK_EXTRA_ARTISTS,
    );
    if (more.length > 0) {
      tracks = tracks.concat(await getTracksForArtists(more, def.country));
    }
  }

  // The same song can arrive twice via different releases.
  const byId = new Map<string, Track>();
  for (const t of tracks) byId.set(t.id, t);
  const pool = [...byId.values()];

  if (pool.length === 0) throw new EmptyCatalogError(category);
  return pool;
}

export const CATALOG_TUNING = { ARTISTS_PER_MATCH, MIN_POOL };
