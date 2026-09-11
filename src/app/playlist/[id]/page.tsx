import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { GROUP_NAME, Lead, PITCH, PlayLink, PublicFrame, Section, Stats, TextLink } from "@/app/PublicFrame";
import { isIndexableArtist } from "@/data/artist-pages";
import { PLAYLISTS, PLAYLIST_GROUPS, PLAYLIST_IDS } from "@/data/seeds";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { CATALOG_TUNING, filterToScript } from "@/server/catalog";
import { getChartTracks, getFixedTracks } from "@/server/itunes";
import { ARTISTS_PATH, OPEN_GRAPH_BASE, artistPath, playHref, playlistPath } from "@/shared/site";
import { STRINGS } from "@/shared/strings";
import type { PlaylistId, Track } from "@/shared/types";

/**
 * One public page per Playlist — the part of the site a search engine can read.
 *
 * The game is a single client page whose every screen shares one URL, so a
 * crawler found nothing there but a title. These are plain server-rendered
 * HTML: what the Playlist is, what is in it, and a link that opens the home
 * screen with this Playlist already chosen for the room the visitor creates.
 */

// Built for every Playlist at deploy, then rebuilt at most every six hours.
// The charts move daily; six hours also bounds how long a page stays without
// its list after one failed fetch.
export const revalidate = 21600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PLAYLIST_IDS.map((id) => ({ id }));
}

type Props = { params: Promise<{ id: string }> };

async function playlistFrom(params: Props["params"]): Promise<PlaylistId> {
  const { id } = await params;
  if (!(PLAYLIST_IDS as string[]).includes(id)) notFound();
  return id as PlaylistId;
}

/**
 * The songs to print, or null when there is no list to name.
 *
 * Artist Playlists draw a different handful of acts every Match, so they have
 * no fixed track list — their page names the artists instead. A failed fetch
 * lands on null too: the page still renders, just without the list, and the
 * next rebuild tries again. Cached per render so the metadata and the page
 * share one fetch.
 */
const tracksFor = cache(async (id: PlaylistId): Promise<Track[] | null> => {
  const { source } = PLAYLISTS[id];
  try {
    if (source.kind === "tracks") {
      return await getFixedTracks(id, source.trackIds, source.country, source.series);
    }
    if (source.kind === "chart") {
      const chart = await getChartTracks(source.country, CATALOG_TUNING.CHART_DEPTH);
      return source.script ? filterToScript(chart, source.script) : chart;
    }
  } catch (err) {
    console.warn(`[playlist page] ${id} rendered without its songs:`, (err as Error).message);
  }
  return null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await playlistFrom(params);
  const { heading, blurb } = PLAYLIST_PAGES[id];
  const { source } = PLAYLISTS[id];
  const tracks = await tracksFor(id);

  // A few real names in the snippet, since those are what people search.
  const examples =
    source.kind === "artists"
      ? `ศิลปินอย่าง ${source.artists.slice(0, 3).join(", ")}`
      : tracks && tracks.length > 0
        ? `มีเพลงอย่าง ${tracks.slice(0, 3).map((t) => t.title).join(", ")}`
        : "";
  const description = [blurb, examples, PITCH].filter(Boolean).join(" ");
  const title = `${heading} — เกมทายเพลงออนไลน์`;

  return {
    title,
    description,
    alternates: { canonical: playlistPath(id) },
    openGraph: { ...OPEN_GRAPH_BASE, title, description, url: playlistPath(id) },
  };
}

export default async function PlaylistPage({ params }: Props) {
  const id = await playlistFrom(params);
  const { group, source } = PLAYLISTS[id];
  const { heading, blurb } = PLAYLIST_PAGES[id];
  const tracks = await tracksFor(id);
  const artists = source.kind === "artists" ? source.artists : null;

  const stats: Array<[string, string]> = [];
  if (tracks && tracks.length > 0) {
    stats.push(["เพลง", String(tracks.length)]);
    stats.push(["ศิลปิน", String(new Set(tracks.map((t) => t.artist)).size)]);
  }
  if (artists) stats.push(["ศิลปิน", String(artists.length)]);
  if (source.kind === "artists" && (source.yearFrom || source.yearTo)) {
    stats.push(["ปี", `${source.yearFrom ?? ""}–${source.yearTo ?? "ปัจจุบัน"}`]);
  }
  if (source.kind === "chart") stats.push(["อัปเดต", "ทุกวัน"]);

  return (
    <PublicFrame crumbs={[{ label: STRINGS.appName.th, href: "/" }, { label: GROUP_NAME[group] }]}>
      <Lead
        heading={heading}
        sub={STRINGS[`playlist.${id}`].en}
        body={`${blurb} ${PITCH}`}
        aside={
          <>
            <Stats items={stats} />
            <PlayLink href={playHref(id)}>เล่นเพลย์ลิสต์นี้</PlayLink>
          </>
        }
      />

      {tracks && tracks.length > 0 && (
        <Section title={source.kind === "chart" ? "เพลงในชาร์ตตอนนี้" : "เพลงในเพลย์ลิสต์"}>
          <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t, i) => (
              <li key={t.id} className="flex gap-3 border-b border-grey-300 py-3">
                <span className="numeric w-8 shrink-0 text-grey-500">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{t.title}</span>
                  <span className="block text-grey-500" style={{ fontSize: "0.875rem" }}>
                    {t.series ? `${t.series} · ${t.artist}` : t.artist}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {artists && (
        <Section title="ศิลปินในเพลย์ลิสต์">
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {artists.map((name) => (
              <li key={name} className="border-b border-grey-300 py-3 font-medium">
                {isIndexableArtist(name) ? <TextLink href={artistPath(name)}>{name}</TextLink> : name}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="เพลย์ลิสต์อื่น">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PLAYLIST_GROUPS.map(({ group: g, ids }) => (
            <div key={g}>
              <div className="label text-grey-500">{GROUP_NAME[g]}</div>
              <ul className="mt-3 space-y-2">
                {ids.map((other) => (
                  <li key={other}>
                    {other === id ? (
                      <span aria-current="page" className="font-semibold">
                        {PLAYLIST_PAGES[other].heading}
                      </span>
                    ) : (
                      <TextLink href={playlistPath(other)}>{PLAYLIST_PAGES[other].heading}</TextLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="label mt-10">
          <TextLink href={ARTISTS_PATH}>ทายเพลงตามศิลปิน →</TextLink>
        </p>
      </Section>
    </PublicFrame>
  );
}
