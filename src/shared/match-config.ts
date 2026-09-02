import type { GameModeId, PlaylistId, SongSource } from "./types";
import { MODES } from "./modes";
import { PLAYLISTS, PLAYLIST_IDS } from "@/data/seeds";

/**
 * Which Game Modes can play which Song Sources.
 *
 * Mode and Source were independent until the anime mode, whose question — what
 * is this song from? — only a Playlist shipping a series map can answer. This
 * module is the whole of that coupling. The picker, the lobby and the guard in
 * `setConfig` all read the rule from here, so there is one answer rather than
 * three that drift apart.
 */

/** The Playlists that name the show each of their songs is from. */
export function seriesPlaylistIds(): PlaylistId[] {
  return PLAYLIST_IDS.filter((id) => {
    const { source } = PLAYLISTS[id];
    return source.kind === "tracks" && source.series !== undefined;
  });
}

export function sourceSuitsMode(mode: GameModeId, source: SongSource): boolean {
  if (!MODES[mode].requiresSeries) return true;
  // An artist pool is one act's catalogue straight from iTunes; there is
  // nowhere for a series to have come from.
  if (source.kind !== "playlist") return false;
  const def = PLAYLISTS[source.playlist].source;
  return def.kind === "tracks" && def.series !== undefined;
}

/**
 * The Source to use when switching to `mode`.
 *
 * Returns `current` untouched whenever it already works, so switching *away*
 * from the anime mode keeps the anime Playlist selected — it is a perfectly
 * good pool for "which song is this?".
 */
export function defaultSourceForMode(
  mode: GameModeId,
  current: SongSource,
): SongSource {
  if (sourceSuitsMode(mode, current)) return current;
  const first = seriesPlaylistIds()[0];
  // No series Playlist has shipped: leave the Source alone and let the server
  // guard refuse the config, rather than naming one that does not exist.
  if (!first) return current;
  return { kind: "playlist", playlist: first };
}
