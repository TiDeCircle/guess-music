import type { Metadata } from "next";
import { GROUP_NAME, Lead, PITCH, PublicFrame, Section, TextLink } from "@/app/PublicFrame";
import { INDEXABLE_ARTISTS, artistSongs } from "@/data/artist-pages";
import { ARTISTS_PATH, OPEN_GRAPH_BASE, artistPath } from "@/shared/site";
import { STRINGS } from "@/shared/strings";
import type { PlaylistGroup } from "@/shared/types";

/**
 * The index of artist pages — the one place that links to all of them, and
 * what the home screen's "all artists" points at.
 */

const GROUPS: PlaylistGroup[] = ["thai", "intl", "kpop"];

const title = "ทายเพลงตามศิลปิน — เลือกศิลปินที่ชอบแล้วทายเพลงของเขา";
const description = `ทายเพลงของศิลปินคนเดียวทั้งเกม ทุกตัวเลือกเป็นเพลงของศิลปินคนนั้น มี ${INDEXABLE_ARTISTS.length} ศิลปิน ทั้งเพลงไทย สากล และเคป็อป ${PITCH}`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ARTISTS_PATH },
  openGraph: { ...OPEN_GRAPH_BASE, title, description, url: ARTISTS_PATH },
};

export default function ArtistIndexPage() {
  return (
    <PublicFrame crumbs={[{ label: STRINGS.appName.th, href: "/" }, { label: STRINGS.allArtists.th }]}>
      <Lead
        heading="ทายเพลงตามศิลปิน"
        sub={`${INDEXABLE_ARTISTS.length} ศิลปิน`}
        body={`เลือกศิลปินที่ชอบ แล้วทายว่าเป็นเพลงไหนของเขา ทุกตัวเลือกเป็นเพลงของศิลปินคนเดียวกัน ฟังเสียงร้องช่วยไม่ได้ ต้องรู้จักเพลงจริง ๆ ${PITCH}`}
        aside={null}
      />

      {GROUPS.map((group) => {
        const artists = INDEXABLE_ARTISTS.filter((a) => a.group === group);
        if (artists.length === 0) return null;
        return (
          <Section key={group} title={`ศิลปิน${GROUP_NAME[group]}`}>
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {artists.map((a) => (
                <li
                  key={a.name}
                  className="flex items-baseline justify-between gap-3 border-b border-grey-300 py-3"
                >
                  <TextLink href={artistPath(a.name)}>{a.name}</TextLink>
                  <span className="numeric text-grey-500" style={{ fontSize: "0.875rem" }}>
                    {artistSongs(a.name).length}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </PublicFrame>
  );
}
