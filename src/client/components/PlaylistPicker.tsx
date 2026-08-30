"use client";

import { useState } from "react";
import type { PlaylistGroup, PlaylistId } from "@/shared/types";
import { PLAYLISTS, PLAYLIST_GROUPS } from "@/data/seeds";
import { useLang, type StringKey } from "@/client/i18n";
import { FieldLabel } from "./Shell";

const GROUP_LABEL: Record<PlaylistGroup, StringKey> = {
  thai: "groupThai",
  intl: "groupIntl",
  kpop: "groupKpop",
};

/**
 * Choosing a Playlist in two steps: the language first, then the Playlist.
 *
 * Nine options laid out at once left half the grid empty — two of the three
 * groups hold only two Playlists — and a sparse grid reads as unfinished rather
 * than spacious. Split in two, each step is full.
 *
 * Picking a Playlist returns to the language step on purpose: that step doubles
 * as the summary, naming the current choice under its own language, so the
 * lobby always shows what the room is about to play without a separate line
 * repeating it.
 */
export function PlaylistPicker({
  value,
  disabled,
  onSelect,
}: {
  value: PlaylistId;
  disabled: boolean;
  onSelect: (id: PlaylistId) => void;
}) {
  const { t } = useLang();
  const [openGroup, setOpenGroup] = useState<PlaylistGroup | null>(null);
  const selectedGroup = PLAYLISTS[value].group;

  // A player who cannot change it does not need a navigator, only the answer.
  if (disabled) {
    return (
      <div>
        <FieldLabel>{t("playlist")}</FieldLabel>
        <p className="mt-2 py-4" style={{ fontSize: "var(--text-body)" }}>
          {t(`playlist.${value}` as StringKey)}
        </p>
      </div>
    );
  }

  if (openGroup === null) {
    return (
      <div>
        <FieldLabel>{t("playlist")}</FieldLabel>
        <div className="swap-from-left mt-2 grid grid-cols-3 gap-px bg-ink">
          {PLAYLIST_GROUPS.map(({ group, ids }) => {
            const holdsSelection = group === selectedGroup;
            return (
              <button
                key={group}
                type="button"
                onClick={() => setOpenGroup(group)}
                className={`flex min-h-24 flex-col justify-between p-3 text-left transition-colors md:p-4 ${
                  holdsSelection
                    ? "bg-ink text-paper"
                    : "bg-paper text-ink hover:bg-grey-100"
                }`}
              >
                <span className="label">{t(GROUP_LABEL[group])}</span>
                <span
                  className={`mt-4 block text-[0.9375rem] ${
                    holdsSelection ? "" : "text-grey-500"
                  }`}
                >
                  {holdsSelection
                    ? t(`playlist.${value}` as StringKey)
                    : `${ids.length} ${t("playlistsCount")}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const ids = PLAYLIST_GROUPS.find((g) => g.group === openGroup)!.ids;

  return (
    <div>
      <div className="flex items-baseline justify-between border-t border-ink pt-2">
        <span className="label text-grey-500">{t(GROUP_LABEL[openGroup])}</span>
        <button
          type="button"
          onClick={() => setOpenGroup(null)}
          className="label text-grey-500 transition-colors hover:text-ink"
        >
          ← {t("back")}
        </button>
      </div>

      <div className="swap-from-right mt-2 grid grid-cols-1 gap-px bg-ink sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onSelect(id);
                setOpenGroup(null);
              }}
              className={`flex min-h-20 flex-col justify-between p-3 text-left transition-colors md:p-4 ${
                active
                  ? "bg-ink text-paper"
                  : "bg-paper text-ink hover:bg-grey-100"
              }`}
            >
              <span className="text-[0.9375rem] font-medium">
                {t(`playlist.${id}` as StringKey)}
              </span>
              <span
                className={`label mt-3 ${active ? "text-grey-300" : "text-grey-500"}`}
              >
                {PLAYLISTS[id].source.kind === "chart" ? t("chartHint") : " "}
              </span>
            </button>
          );
        })}
        {/* Keeps the grid's black lines from showing through a short last row. */}
        {Array.from(
          { length: (3 - (ids.length % 3)) % 3 },
          (_, i) => (
            <div key={`blank-${i}`} aria-hidden className="hidden bg-paper lg:block" />
          ),
        )}
        {ids.length % 2 === 1 && (
          <div aria-hidden className="hidden bg-paper sm:block lg:hidden" />
        )}
      </div>
    </div>
  );
}
