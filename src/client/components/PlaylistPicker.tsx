"use client";

import { useMemo, useState } from "react";
import type { PlaylistGroup, PlaylistId, SongSource } from "@/shared/types";
import { PLAYLISTS, PLAYLIST_GROUPS } from "@/data/seeds";
import { ARTISTS } from "@/data/seeds/artists";
import { useLang, type StringKey } from "@/client/i18n";
import { FieldLabel } from "./Shell";

const GROUP_LABEL: Record<PlaylistGroup, StringKey> = {
  thai: "groupThai",
  intl: "groupIntl",
  kpop: "groupKpop",
};

/** Which panel is open. `null` is the top level. */
type Step = PlaylistGroup | "artist" | null;

/**
 * Choosing what a Match plays, in two steps.
 *
 * Nine playlists laid out at once left half the grid empty — two of the three
 * language groups hold only two — and a sparse grid reads as unfinished rather
 * than spacious. Split in two, each step is full.
 *
 * Picking returns to the top step on purpose: that step names the current
 * choice under its own heading, so it doubles as the summary and the lobby
 * never needs a separate line repeating what the room is about to play.
 */
export function PlaylistPicker({
  value,
  disabled,
  onSelect,
}: {
  value: SongSource;
  disabled: boolean;
  onSelect: (source: SongSource) => void;
}) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>(null);
  const [filter, setFilter] = useState("");

  const label =
    value.kind === "artist"
      ? value.artist
      : t(`playlist.${value.playlist}` as StringKey);

  // A player who cannot change it does not need a navigator, only the answer.
  if (disabled) {
    return (
      <div>
        <FieldLabel>{t("playlist")}</FieldLabel>
        <p className="mt-2 py-4" style={{ fontSize: "var(--text-body)" }}>
          {label}
        </p>
      </div>
    );
  }

  if (step === null) {
    return (
      <div>
        <FieldLabel>{t("playlist")}</FieldLabel>
        <div className="swap-from-left mt-2 grid grid-cols-2 gap-px bg-ink sm:grid-cols-4">
          {PLAYLIST_GROUPS.map(({ group, ids }) => (
            <TopCell
              key={group}
              title={t(GROUP_LABEL[group])}
              active={value.kind === "playlist" && PLAYLISTS[value.playlist].group === group}
              detail={
                value.kind === "playlist" && PLAYLISTS[value.playlist].group === group
                  ? label
                  : `${ids.length} ${t("playlistsCount")}`
              }
              onClick={() => setStep(group)}
            />
          ))}
          <TopCell
            title={t("byArtist")}
            active={value.kind === "artist"}
            detail={
              value.kind === "artist"
                ? label
                : `${ARTISTS.length} ${t("artistsCount")}`
            }
            onClick={() => {
              setFilter("");
              setStep("artist");
            }}
          />
        </div>
      </div>
    );
  }

  if (step === "artist") {
    const query = filter.trim().toLowerCase();
    const shown = query
      ? ARTISTS.filter((a) => a.name.toLowerCase().includes(query))
      : ARTISTS;

    return (
      <div>
        <PanelHeader title={t("byArtist")} onBack={() => setStep(null)} />
        <p className="label mt-2 text-grey-500">{t("byArtistHint")}</p>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("filterArtists")}
          autoComplete="off"
          className="mt-3 w-full border-b border-ink bg-transparent pb-2 outline-none placeholder:text-grey-300 focus:border-accent"
          style={{ fontSize: "var(--text-body)" }}
        />

        {/* The list is long by design, so it scrolls inside its own box rather
            than pushing the start button off the screen. */}
        <div className="swap-from-right mt-3 max-h-72 overflow-y-auto border-y border-ink">
          {shown.length === 0 && (
            <p className="label px-3 py-4 text-grey-500">{t("noArtists")}</p>
          )}
          {shown.map((a) => {
            const active = value.kind === "artist" && value.artist === a.name;
            return (
              <button
                key={a.name}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelect({ kind: "artist", artist: a.name });
                  setStep(null);
                }}
                className={`flex w-full items-baseline justify-between border-b border-grey-300 px-3 py-3 text-left transition-colors last:border-b-0 ${
                  active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
                }`}
              >
                <span style={{ fontSize: "var(--text-body)" }}>{a.name}</span>
                <span
                  className={`label ${active ? "text-grey-300" : "text-grey-500"}`}
                >
                  {t(GROUP_LABEL[a.group])}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const ids = PLAYLIST_GROUPS.find((g) => g.group === step)!.ids;

  return (
    <div>
      <PanelHeader title={t(GROUP_LABEL[step])} onBack={() => setStep(null)} />
      <div className="swap-from-right mt-2 grid grid-cols-1 gap-px bg-ink sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => {
          const active = value.kind === "playlist" && value.playlist === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onSelect({ kind: "playlist", playlist: id });
                setStep(null);
              }}
              className={`flex min-h-20 flex-col justify-between p-3 text-left transition-colors md:p-4 ${
                active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
              }`}
            >
              <span className="text-[0.9375rem] font-medium">
                {t(`playlist.${id}` as StringKey)}
              </span>
              <span
                className={`label mt-3 ${active ? "text-grey-300" : "text-grey-500"}`}
              >
                {PLAYLISTS[id].source.kind === "chart" ? t("chartHint") : " "}
              </span>
            </button>
          );
        })}
        {/* Keeps the grid's black lines from showing through a short last row. */}
        {blanks(ids.length, 3).map((k) => (
          <div key={k} aria-hidden className="hidden bg-paper lg:block" />
        ))}
        {blanks(ids.length, 2).map((k) => (
          <div key={k} aria-hidden className="hidden bg-paper sm:block lg:hidden" />
        ))}
      </div>
    </div>
  );
}

function blanks(count: number, columns: number): string[] {
  const missing = (columns - (count % columns)) % columns;
  return Array.from({ length: missing }, (_, i) => `blank-${columns}-${i}`);
}

function TopCell({
  title,
  detail,
  active,
  onClick,
}: {
  title: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-24 flex-col justify-between p-3 text-left transition-colors md:p-4 ${
        active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
      }`}
    >
      <span className="label">{title}</span>
      <span
        className={`mt-4 block text-[0.9375rem] ${active ? "" : "text-grey-500"}`}
      >
        {detail}
      </span>
    </button>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex items-baseline justify-between border-t border-ink pt-2">
      <span className="label text-grey-500">{title}</span>
      <button
        type="button"
        onClick={onBack}
        className="label text-grey-500 transition-colors hover:text-ink"
      >
        ← {t("back")}
      </button>
    </div>
  );
}
