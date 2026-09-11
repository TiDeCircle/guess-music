import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Logo } from "@/client/components/Logo";
import { PLAYLISTS, PLAYLIST_GROUPS, PLAYLIST_IDS } from "@/data/seeds";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { CATALOG_TUNING, filterToScript } from "@/server/catalog";
import { getChartTracks, getFixedTracks } from "@/server/itunes";
import { OPEN_GRAPH_BASE, playHref, playlistPath } from "@/shared/site";
import { STRINGS } from "@/shared/strings";
import type { PlaylistGroup, PlaylistId, Track } from "@/shared/types";

/**
 * One public page per Playlist — the part of the site a search engine can read.
 *
 * The game is a single client page whose every screen shares one URL, so a
 * crawler found nothing there but a title. These are plain server-rendered
 * HTML: what the Playlist is, what is in it, and a link that opens the home
 * screen with this Playlist already chosen for the room the visitor creates.
 *
 * Thai only, and deliberately so: the people typing "ทายเพลงลูกทุ่ง" are the
 * audience. The language toggle stays in the game.
 */

// Built for every Playlist at deploy, then rebuilt at most every six hours.
// The charts move daily; six hours also bounds how long a page stays without
// its list after one failed fetch.
export const revalidate = 21600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PLAYLIST_IDS.map((id) => ({ id }));
}

const PITCH = "ฟังคลิปสั้น ๆ แล้วทายชื่อเพลง เล่นคนเดียวหรือสร้างห้องแข่งกับเพื่อนแบบเรียลไทม์ ฟรี ไม่ต้องสมัคร";

const GROUP_NAME: Record<PlaylistGroup, string> = {
  thai: STRINGS.groupThai.th,
  intl: STRINGS.groupIntl.th,
  kpop: STRINGS.groupKpop.th,
  anime: STRINGS.groupAnime.th,
};

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
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-[1200px] items-center px-4 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Logo className="h-6 w-6 shrink-0" />
            <span className="label truncate font-bold">{STRINGS.appName.th}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-12">
        <nav aria-label="breadcrumb" className="label text-grey-500">
          <Link href="/" className="hover:text-ink">
            {STRINGS.appName.th}
          </Link>{" "}
          / {GROUP_NAME[group]}
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-12 md:gap-8">
          <section className="md:col-span-7">
            <h1
              className="text-balance font-bold leading-[0.95] tracking-[-0.03em]"
              style={{ fontSize: "clamp(2.5rem, 8vw, 4.5rem)" }}
            >
              {heading}
            </h1>
            <p className="label mt-3 text-grey-500">{STRINGS[`playlist.${id}`].en}</p>
            <p className="mt-6 max-w-xl text-pretty" style={{ fontSize: "var(--text-body)" }}>
              {blurb} {PITCH}
            </p>
          </section>

          <section className="md:col-span-5">
            {stats.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
                {stats.map(([label, value]) => (
                  <div key={label} className="border-t border-ink pt-2">
                    <dt className="label text-grey-500">{label}</dt>
                    <dd
                      className="numeric mt-2 font-bold leading-none"
                      style={{ fontSize: "var(--text-title)" }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <Link
              href={playHref(id)}
              className="press label mt-8 block w-full border border-ink bg-ink px-6 py-4 text-center text-paper hover:bg-paper hover:text-ink"
            >
              เล่นเพลย์ลิสต์นี้
            </Link>
          </section>
        </div>

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
                  {name}
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
                        <Link
                          href={playlistPath(other)}
                          className="underline-offset-4 hover:text-accent hover:underline"
                        >
                          {PLAYLIST_PAGES[other].heading}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}

/** A heading on a full rule, the same way the home screen marks its two routes. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="border-t border-ink pt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
