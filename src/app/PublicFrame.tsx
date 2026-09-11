import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/client/components/Logo";
import { ARTISTS_PATH } from "@/shared/site";
import { STRINGS } from "@/shared/strings";
import type { PlaylistGroup } from "@/shared/types";

/**
 * The pieces the public pages are built from — the playlist and artist pages
 * written for search engines.
 *
 * The game's own Shell carries volume, theme and connection state, none of
 * which mean anything on a page with no room behind it, so this is the same
 * hairline header with only the ways around the site. Thai only, like the pages
 * themselves: the people typing "ทายเพลง…" into a search box are the audience.
 */

export const PITCH =
  "ฟังคลิปสั้น ๆ แล้วทายชื่อเพลง เล่นคนเดียวหรือสร้างห้องแข่งกับเพื่อนแบบเรียลไทม์ ฟรี ไม่ต้องสมัคร";

export const GROUP_NAME: Record<PlaylistGroup, string> = {
  thai: STRINGS.groupThai.th,
  intl: STRINGS.groupIntl.th,
  kpop: STRINGS.groupKpop.th,
  anime: STRINGS.groupAnime.th,
};

export function PublicFrame({
  crumbs,
  children,
}: {
  crumbs: Array<{ label: string; href?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Logo className="h-6 w-6 shrink-0" />
            <span className="label truncate font-bold">{STRINGS.appName.th}</span>
          </Link>
          <Link href={ARTISTS_PATH} className="label hover:text-accent">
            {STRINGS.allArtists.th}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-12">
        <nav aria-label="breadcrumb" className="label text-grey-500">
          {crumbs.map((crumb, i) => (
            <span key={crumb.label}>
              {i > 0 && " / "}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                crumb.label
              )}
            </span>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}

/** The opening block: the search phrase set big, what it is, and the way in beside it. */
export function Lead({
  heading,
  sub,
  body,
  aside,
}: {
  heading: string;
  sub: string;
  body: string;
  aside: ReactNode;
}) {
  return (
    <div className="mt-6 grid gap-10 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-7">
        <h1
          className="text-balance break-words font-bold leading-[0.95] tracking-[-0.03em]"
          style={{ fontSize: "clamp(2.5rem, 8vw, 4.5rem)" }}
        >
          {heading}
        </h1>
        <p className="label mt-3 text-grey-500">{sub}</p>
        <p className="mt-6 max-w-xl text-pretty" style={{ fontSize: "var(--text-body)" }}>
          {body}
        </p>
      </section>
      <section className="md:col-span-5">{aside}</section>
    </div>
  );
}

/** Numbers over hairlines, the same band the home screen opens with. */
export function Stats({ items }: { items: Array<[string, string]> }) {
  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
      {items.map(([label, value], i) => (
        <div key={i} className="border-t border-ink pt-2">
          <dt className="label text-grey-500">{label}</dt>
          <dd className="numeric mt-2 font-bold leading-none" style={{ fontSize: "var(--text-title)" }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The solid ink block — the one action a public page is about. */
export function PlayLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="press label mt-8 block w-full border border-ink bg-ink px-6 py-4 text-center text-paper hover:bg-paper hover:text-ink"
    >
      {children}
    </Link>
  );
}

/** A heading on a full rule, the way the home screen marks its two routes. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="border-t border-ink pt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A plain text link in the public pages' one style. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="underline-offset-4 hover:text-accent hover:underline">
      {children}
    </Link>
  );
}
