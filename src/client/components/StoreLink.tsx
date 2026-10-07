"use client";

import type { Track } from "@/shared/types";
import { useLang } from "@/client/i18n";

/**
 * Apple lets us play a Preview only to promote the song, beside a way to get it
 * and with their credit. Every place that reveals a song shows this.
 */
export function StoreLink({ track, compact = false }: { track: Track; compact?: boolean }) {
  const { t } = useLang();
  if (!track.storeUrl) return null;
  return (
    <a
      href={track.storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={
        compact
          ? "label text-grey-500 underline decoration-1 underline-offset-2 hover:text-ink"
          : "label inline-block border border-ink bg-paper px-3 py-2 text-ink transition-colors hover:bg-grey-100"
      }
    >
      {t("listenOnAppleMusic")} ↗
    </a>
  );
}

/** Apple's wording, required wherever a Preview plays. */
export function PreviewCredit() {
  const { t } = useLang();
  return <p className="label mt-3 text-grey-300">{t("previewCredit")}</p>;
}
