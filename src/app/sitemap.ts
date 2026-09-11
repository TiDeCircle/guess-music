import type { MetadataRoute } from "next";
import { PLAYLISTS, PLAYLIST_IDS } from "@/data/seeds";
import { SITE_URL, playlistPath } from "@/shared/site";

/**
 * The home page and one page per Playlist — read off the registry, so a new
 * Playlist is listed the moment it ships.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...PLAYLIST_IDS.map(
      (id): MetadataRoute.Sitemap[number] => ({
        url: `${SITE_URL}${playlistPath(id)}`,
        // A chart page lists whatever Apple's feed says today.
        changeFrequency: PLAYLISTS[id].source.kind === "chart" ? "daily" : "monthly",
        priority: 0.8,
      }),
    ),
  ];
}
