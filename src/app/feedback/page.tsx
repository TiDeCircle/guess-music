import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/app/PublicFrame";
import { adminKeyMatches } from "@/server/adminKey";
import { feedbackStore } from "@/server/feedback";
import { STRINGS } from "@/shared/strings";

/**
 * The admin's reading view of what players sent: /feedback?key=<FEEDBACK_KEY>.
 *
 * There are no accounts in this app, so a long secret in the address is the
 * whole lock. Without FEEDBACK_KEY set, or with the wrong one, the page does
 * not exist — a 404 says nothing about there being something here to guess at.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

const when = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export default async function FeedbackAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!adminKeyMatches(key)) notFound();

  const entries = await feedbackStore().list();

  return (
    <PublicFrame crumbs={[{ label: STRINGS.appName.th, href: "/" }, { label: "Feedback" }]}>
      <h1 className="mt-6 font-bold" style={{ fontSize: "var(--text-title)" }}>
        Feedback <span className="numeric text-grey-500">{entries.length}</span>
      </h1>

      {entries.length === 0 ? (
        <p className="mt-8 text-grey-500">ยังไม่มีใครส่งมา</p>
      ) : (
        <ol className="mt-8">
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="grid gap-2 border-t border-ink py-4 md:grid-cols-12 md:gap-8">
              <div className="label flex flex-wrap gap-x-3 text-grey-500 md:col-span-3 md:flex-col">
                <span className="text-accent">{STRINGS[`feedbackKind.${e.kind}`].th}</span>
                <span className="numeric">{when.format(new Date(e.at))}</span>
                {e.context && <span>{e.context}</span>}
              </div>
              <div className="md:col-span-9">
                <p className="whitespace-pre-wrap text-pretty">{e.message}</p>
                {e.contact && (
                  <p className="mt-2 text-grey-500">
                    ติดต่อกลับ: <span className="text-ink">{e.contact}</span>
                  </p>
                )}
                <p className="mt-2 truncate text-xs text-grey-300" title={e.userAgent}>
                  {e.lang.toUpperCase()} · {e.userAgent}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </PublicFrame>
  );
}
