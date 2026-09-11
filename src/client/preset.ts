import { isKnownArtist } from "@/data/seeds/artists";
import { playlistSchema } from "@/shared/protocol";
import { PRESET_ARTIST_PARAM, PRESET_PLAYLIST_PARAM } from "@/shared/site";
import type { SongSource } from "@/shared/types";

/**
 * The Song Source a public page's "play" link asked for, if it names a real one.
 *
 * Checked against what the server itself accepts — the playlist schema and the
 * artist allowlist — so a hand-edited query can only ever select something the
 * picker could have.
 */
export function readPresetSource(search: string): SongSource | null {
  const params = new URLSearchParams(search);

  const playlist = playlistSchema.safeParse(params.get(PRESET_PLAYLIST_PARAM));
  if (playlist.success) return { kind: "playlist", playlist: playlist.data };

  const artist = params.get(PRESET_ARTIST_PARAM);
  if (artist && isKnownArtist(artist)) return { kind: "artist", artist };

  return null;
}
