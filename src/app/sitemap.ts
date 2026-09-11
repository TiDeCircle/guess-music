import type { MetadataRoute } from "next";
import { INDEXABLE_ARTISTS } from "@/data/artist-pages";
import { PLAYLISTS, PLAYLIST_IDS } from "@/data/seeds";
import { ARTISTS_PATH, SITE_URL, artistPath, playlistPath } from "@/shared/site";

type Entry = MetadataRoute.Sitemap[number];

/**
 * The home page, one page per Playlist, and the artist pages worth a search
 * result — all read off the registries, so a new Playlist or artist is listed
 * the moment it ships.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...PLAYLIST_IDS.map(
      (id): Entry => ({
        url: `${SITE_URL}${playlistPath(id)}`,
        // A chart page lists whatever Apple's feed says today.
        changeFrequency: PLAYLISTS[id].source.kind === "chart" ? "daily" : "monthly",
        priority: 0.8,
      }),
    ),
    { url: `${SITE_URL}${ARTISTS_PATH}`, changeFrequency: "monthly", priority: 0.7 },
    ...INDEXABLE_ARTISTS.map(
      (a): Entry => ({
        url: `${SITE_URL}${artistPath(a.name)}`,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
  ];
}
