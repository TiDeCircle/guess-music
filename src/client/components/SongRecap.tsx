"use client";

import type { MatchSummary } from "@/shared/types";
import { useLang } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/**
 * What the Match actually played.
 *
 * The question everyone asks the moment a round ends is "what was that?", and
 * until now the answer scrolled past six seconds after the reveal. Each row
 * replays the full thirty-second Preview, not the clip length the round used.
 */
export function SongRecap({
  summary,
  playerId,
  previewingId,
  onToggle,
}: {
  summary: MatchSummary;
  playerId: string | null;
  previewingId: string | null;
  onToggle: (trackId: string, url: string) => void;
}) {
  const { t } = useLang();
  if (summary.rounds.length === 0) return null;

  return (
    <section>
      <FieldLabel>{t("songsPlayed")}</FieldLabel>
      <ul className="mt-2">
        {summary.rounds.map((round) => {
          const mine = round.results.find((r) => r.playerId === playerId);
          const playing = previewingId === round.track.id;
          return (
            <li
              key={round.index}
              className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-4 border-b border-grey-300 py-3"
            >
              <span className="numeric label text-grey-500">
                {String(round.index + 1).padStart(2, "0")}
              </span>

              {/* Album art is the one place colour enters this design, so it
                  is spent on the row that is actually playing — the same rule
                  the red accent follows everywhere else. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={round.track.artworkUrl}
                alt=""
                width={48}
                height={48}
                className={`h-12 w-12 border border-ink object-cover transition-[filter] ${
                  playing ? "grayscale-0" : "grayscale"
                }`}
              />

              <span className="min-w-0">
                {/* Two lines rather than an ellipsis: iTunes titles carry long
                    bracketed suffixes, and "ALONE BUT N…" tells you nothing. */}
                <span
                  className={`line-clamp-2 block ${
                    mine?.correct ? "font-semibold" : "text-grey-500"
                  }`}
                  style={{ fontSize: "var(--text-body)" }}
                >
                  {round.track.title}
                </span>
                <span className="label mt-1 block truncate text-grey-500">
                  {round.track.artist}
                  {round.track.year ? ` · ${round.track.year}` : ""}
                </span>
              </span>

              <span className="flex items-center gap-4">
                {/* Score, not a tick: it says both whether you got it and how
                    quickly, which is the interesting part on review. */}
                <span
                  className={`numeric label w-12 text-right ${
                    mine?.correct ? "text-ink" : "text-grey-300"
                  }`}
                >
                  {mine?.gained ? `+${mine.gained}` : "0"}
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(round.track.id, round.track.previewUrl)}
                  className={`label border border-ink px-3 py-2 transition-colors ${
                    playing
                      ? "bg-accent text-paper"
                      : "bg-paper text-ink hover:bg-grey-100"
                  }`}
                >
                  {playing ? t("stopListening") : t("listen")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
