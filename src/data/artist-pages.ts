import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAYLISTS, PLAYLIST_IDS } from "@/data/seeds";
import { ARTISTS, type ArtistEntry } from "@/data/seeds/artists";
import { MIN_ARTIST_POOL } from "@/server/catalog";
import { artistSlug } from "@/shared/site";
import type { PlaylistId } from "@/shared/types";

/**
 * What the public artist pages know about each artist.
 *
 * Read from the shipped song index rather than from iTunes: the index already
 * holds every song of every artist the game ships — the Heardle answer box
 * needs exactly that — so 178 pages cost no requests at build and cannot come
 * out empty because Apple was slow that minute.
 *
 * Server only. The file is half a megabyte, which is why it is read from disk
 * here rather than imported into anything a browser might load.
 */
type SongIndex = { generatedAt: string; artists: Array<[string, string[]]> };

const index: SongIndex = JSON.parse(
  readFileSync(join(process.cwd(), "public/song-index.json"), "utf8"),
);
const exact = new Map(index.artists);
// The index keys artists the way iTunes spells them, which is sometimes a
// different case from the seed list — "Bowkylion" against "BOWKYLION".
const folded = new Map(index.artists.map(([name, titles]) => [name.toLowerCase(), titles]));

export function artistSongs(name: string): readonly string[] {
  return exact.get(name) ?? folded.get(name.toLowerCase()) ?? [];
}

/**
 * Whether an artist's page belongs in search results.
 *
 * Every shipped artist has a page, so a shared result always has somewhere to
 * land. Only those with enough songs for artist mode to actually start are put
 * in the sitemap and left indexable; a page listing four songs and a button
 * that fails is not one to send strangers to.
 */
export function isIndexableArtist(name: string): boolean {
  return artistSongs(name).length >= MIN_ARTIST_POOL;
}

export const INDEXABLE_ARTISTS: readonly ArtistEntry[] = ARTISTS.filter((a) =>
  isIndexableArtist(a.name),
);

const bySlug = new Map(ARTISTS.map((a) => [artistSlug(a.name), a]));

export function artistBySlug(slug: string): ArtistEntry | undefined {
  return bySlug.get(slug);
}

/** The artist Playlists that draw on this artist. */
export function playlistsWithArtist(name: string): PlaylistId[] {
  return PLAYLIST_IDS.filter((id) => {
    const { source } = PLAYLISTS[id];
    return source.kind === "artists" && source.artists.includes(name);
  });
}
