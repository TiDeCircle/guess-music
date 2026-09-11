import { playlistSchema } from "@/shared/protocol";
import { PRESET_PARAM } from "@/shared/site";
import type { PlaylistId } from "@/shared/types";

/**
 * The Playlist a playlist page's "play" link asked for, if it names a real one.
 *
 * Checked against the same schema the server guards `room:config` with, so a
 * hand-edited query can only ever select something the picker could have.
 */
export function readPresetPlaylist(search: string): PlaylistId | null {
  const parsed = playlistSchema.safeParse(new URLSearchParams(search).get(PRESET_PARAM));
  return parsed.success ? parsed.data : null;
}
