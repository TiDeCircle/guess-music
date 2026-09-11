import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GROUP_NAME, Lead, PITCH, PlayLink, PublicFrame, Section, Stats, TextLink } from "@/app/PublicFrame";
import {
  INDEXABLE_ARTISTS,
  artistBySlug,
  artistSongs,
  isIndexableArtist,
  playlistsWithArtist,
} from "@/data/artist-pages";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { ARTISTS } from "@/data/seeds/artists";
import {
  ARTISTS_PATH,
  OPEN_GRAPH_BASE,
  artistPath,
  artistPlayHref,
  artistSlug,
  playlistPath,
} from "@/shared/site";
import { STRINGS } from "@/shared/strings";
import type { ArtistEntry } from "@/data/seeds/artists";

/**
 * One public page per artist — what "ทายเพลง Bodyslam" should land on.
 *
 * Artist mode already exists in the game, and every one of its options is by
 * the same act, so each artist is a quiz of its own. Searches like that turn up
 * user-made quizzes and videos, but nothing you can simply start playing; this
 * page is that, with the button that opens a room in artist mode.
 *
 * Fully static: the song list comes from the shipped index, so there is
 * nothing to refresh until the next deploy rebuilds the index.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTISTS.map((a) => ({ slug: artistSlug(a.name) }));
}

type Props = { params: Promise<{ slug: string }> };

async function artistFrom(params: Props["params"]): Promise<ArtistEntry> {
  const { slug } = await params;
  const artist = artistBySlug(slug);
  if (!artist) notFound();
  return artist;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await artistFrom(params);
  const songs = artistSongs(name);
  const title = `ทายเพลง ${name} — เกมทายเพลงออนไลน์`;
  const examples = songs.length > 0 ? ` มีเพลงอย่าง ${songs.slice(0, 3).join(", ")}` : "";
  const description = `ทายเพลง ${name} ฟังคลิปแล้วทายว่าเป็นเพลงไหน ทุกตัวเลือกเป็นเพลงของ ${name} ทั้งหมด${examples} ${PITCH}`;

  return {
    title,
    description,
    alternates: { canonical: artistPath(name) },
    openGraph: { ...OPEN_GRAPH_BASE, title, description, url: artistPath(name) },
    // Kept reachable for shared links, but out of search results — see
    // isIndexableArtist.
    ...(isIndexableArtist(name) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ArtistPage({ params }: Props) {
  const { name, group } = await artistFrom(params);
  const songs = artistSongs(name);
  const playlists = playlistsWithArtist(name);
  const others = INDEXABLE_ARTISTS.filter((a) => a.group === group && a.name !== name);

  const stats: Array<[string, string]> = [];
  if (songs.length > 0) stats.push(["เพลงในคลัง", String(songs.length)]);
  if (playlists.length > 0) stats.push(["อยู่ในเพลย์ลิสต์", String(playlists.length)]);

  return (
    <PublicFrame
      crumbs={[
        { label: STRINGS.appName.th, href: "/" },
        { label: STRINGS.allArtists.th, href: ARTISTS_PATH },
        { label: GROUP_NAME[group] },
      ]}
    >
      <Lead
        heading={`ทายเพลง ${name}`}
        sub={`โหมดศิลปิน · ${GROUP_NAME[group]}`}
        body={`ทุกข้อเป็นเพลงของ ${name} และตัวเลือกที่เหลือก็เป็นเพลงของ ${name} เหมือนกัน ฟังเสียงร้องช่วยไม่ได้ ต้องจำเพลงได้จริง ๆ ถึงจะตอบถูก ${PITCH}`}
        aside={
          <>
            <Stats items={stats} />
            <PlayLink href={artistPlayHref(name)}>เล่นทายเพลง {name}</PlayLink>
          </>
        }
      />

      {songs.length > 0 && (
        <Section title={`เพลงของ ${name}`}>
          <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((title, i) => (
              <li key={title} className="flex gap-3 border-b border-grey-300 py-3">
                <span className="numeric w-8 shrink-0 text-grey-500">{i + 1}</span>
                <span className="min-w-0 font-medium">{title}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {playlists.length > 0 && (
        <Section title="อยู่ในเพลย์ลิสต์">
          <ul className="space-y-2">
            {playlists.map((id) => (
              <li key={id}>
                <TextLink href={playlistPath(id)}>{PLAYLIST_PAGES[id].heading}</TextLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={`ศิลปินอื่นใน${GROUP_NAME[group]}`}>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((a) => (
              <li key={a.name}>
                <TextLink href={artistPath(a.name)}>ทายเพลง {a.name}</TextLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PublicFrame>
  );
}
