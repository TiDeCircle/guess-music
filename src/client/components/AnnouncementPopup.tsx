"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/client/i18n";
import { announcementImageUrl, type Announcement } from "@/shared/announcements";
import { Button } from "./Button";

/** Ids the player has already closed, so a notice shows once per browser, not once per visit. */
const SEEN_KEY = "guess-music.seenAnnouncements";

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function markSeen(id: string, stillLive: string[]) {
  try {
    // Pruned to the notices still being served, so the list cannot grow forever.
    const kept = readSeen().filter((s) => stillLive.includes(s));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...kept, id]));
  } catch {
    // Private mode: the notice comes back next visit, which is the lesser harm.
  }
}

/**
 * The admin's notices, one at a time, newest first, each shown once.
 *
 * Rendered only off a Room (Shell decides): a box over the answer grid
 * mid-round would cost someone the round.
 */
export function AnnouncementPopup() {
  const { t } = useLang();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [live, setLive] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : { announcements: [] }))
      .then(({ announcements }: { announcements: Announcement[] }) => {
        if (cancelled) return;
        const seen = readSeen();
        setLive(announcements.map((a) => a.id));
        setQueue(announcements.filter((a) => !seen.includes(a.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[0];

  const close = () => {
    if (!current) return;
    markSeen(current.id, live);
    setQueue((q) => q.slice(1));
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;

  const external = /^https:\/\//i.test(current.linkUrl);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={close}
    >
      <div
        key={current.id}
        role="dialog"
        aria-modal="true"
        aria-label={current.title || t("announcement")}
        onClick={(e) => e.stopPropagation()}
        className="enter max-h-full w-full max-w-md overflow-y-auto border border-ink bg-paper"
      >
        {current.image && (
          // A plain img: the picture is ours, already sized by the admin page,
          // and next/image would only add a second copy of it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={announcementImageUrl(current.image)}
            alt={current.title}
            className="block max-h-[50dvh] w-full border-b border-ink object-contain"
          />
        )}
        <div className="p-6">
          <p className="label text-accent">
            {t("announcement")}
            {queue.length > 1 && <span className="numeric text-grey-500"> · 1/{queue.length}</span>}
          </p>
          {current.title && (
            <p className="mt-2 font-semibold text-balance" style={{ fontSize: "var(--text-title)" }}>
              {current.title}
            </p>
          )}
          {current.body && (
            <p className="mt-3 whitespace-pre-wrap text-pretty" style={{ fontSize: "var(--text-body)" }}>
              {current.body}
            </p>
          )}

          <div className={`mt-6 grid gap-4 ${current.linkUrl ? "grid-cols-2" : ""}`}>
            <Button variant={current.linkUrl ? "outline" : "solid"} onClick={close} autoFocus>
              {queue.length > 1 ? t("announcementNext") : t("close")}
            </Button>
            {current.linkUrl && (
              <a
                href={current.linkUrl}
                onClick={close}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="press label block w-full border border-ink bg-ink px-6 py-4 text-center text-paper hover:bg-paper hover:text-ink"
              >
                {current.linkLabel || t("announcementOpen")}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
