import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/app/PublicFrame";
import { AnnouncementAdmin } from "@/client/components/AnnouncementAdmin";
import { adminKeyMatches } from "@/server/adminKey";
import { announcementStore } from "@/server/announcements";
import { STRINGS } from "@/shared/strings";

/**
 * Where the admin writes the popup notices: /announcements?key=<FEEDBACK_KEY>.
 *
 * The same key and the same 404 as the feedback page. The key is handed to the
 * form so its requests can carry it; it is already in this page's address, so
 * that tells the browser nothing it did not know.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false, follow: false },
};

export default async function AnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!key || !adminKeyMatches(key)) notFound();

  const announcements = await announcementStore().list();

  return (
    <PublicFrame crumbs={[{ label: STRINGS.appName.th, href: "/" }, { label: "Announcements" }]}>
      <h1 className="mt-6 font-bold" style={{ fontSize: "var(--text-title)" }}>
        ประกาศ Pop-up
      </h1>
      <p className="mt-2 max-w-xl text-pretty text-grey-500">
        ประกาศที่เปิดอยู่จะเด้งขึ้นที่หน้าแรกให้ผู้เล่นทุกคนเห็นคนละครั้ง (ไม่เด้งระหว่างอยู่ในห้อง)
        ถ้ามีหลายอัน จะเรียงจากใหม่ไปเก่า
      </p>
      <AnnouncementAdmin adminKey={key} initial={announcements} />
    </PublicFrame>
  );
}
