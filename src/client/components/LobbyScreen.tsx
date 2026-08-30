"use client";

import { useState, type CSSProperties } from "react";
import type { DifficultyId, MatchConfig, PlaylistGroup, PlaylistId, RoomState } from "@/shared/types";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/shared/difficulty";
import { PLAYLISTS, PLAYLIST_GROUPS } from "@/data/seeds";
import { MAX_PLAYERS } from "@/shared/protocol";
import { useLang, type StringKey } from "@/client/i18n";
import { Button } from "./Button";
import { FieldLabel } from "./Shell";

const GROUP_LABEL: Record<PlaylistGroup, StringKey> = {
  thai: "groupThai",
  intl: "groupIntl",
  kpop: "groupKpop",
};

const DIFFICULTY_LABEL: Record<DifficultyId, StringKey> = {
  easy: "difficultyEasy",
  medium: "difficultyMedium",
  hard: "difficultyHard",
  extreme: "difficultyExtreme",
};

const ROUND_OPTIONS = [5, 10, 15];

export function LobbyScreen({
  room,
  playerId,
  audioUnlocked,
  onUnlockAudio,
  onConfig,
  onStart,
  onLeave,
  starting,
}: {
  room: RoomState;
  playerId: string | null;
  audioUnlocked: boolean;
  onUnlockAudio: () => void;
  onConfig: (config: MatchConfig) => void;
  onStart: () => void;
  onLeave: () => void;
  starting: boolean;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is blocked outside HTTPS and in some browsers; the code is
      // displayed large enough to read out loud anyway.
    }
  };

  const patch = (part: Partial<MatchConfig>) => onConfig({ ...room.config, ...part });

  return (
    <div className="grid gap-12 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-5">
        <FieldLabel>{t("roomCode")}</FieldLabel>
        <button
          type="button"
          onClick={copyCode}
          className="numeric mt-2 block font-bold leading-[0.85] tracking-[0.06em] transition-colors hover:text-accent"
          style={{ fontSize: "clamp(4rem, 22vw, var(--text-display))" }}
        >
          {room.code}
        </button>
        <p className="label mt-4 text-grey-500">
          {copied ? t("copied") : t("shareHint")}
        </p>

        <div className="mt-10">
          <FieldLabel>
            {t("players")} — {room.players.length}/{MAX_PLAYERS}
          </FieldLabel>
          <ul className="mt-2">
            {room.players.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between border-b border-grey-300 py-3"
                style={{ fontSize: "var(--text-body)" }}
              >
                <span className={p.connected ? "" : "text-grey-300 line-through"}>
                  {p.name}
                </span>
                <span className="label text-grey-500">
                  {p.id === room.hostId ? t("host") : ""}
                  {p.id === playerId ? ` · ${t("you")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-8 md:col-span-7">
        <div>
          <FieldLabel>{t("playlist")}</FieldLabel>
          {/* Grouped by language so nine options stay scannable, but the choice
              itself is flat: one click picks a Playlist, not a group then a
              playlist. */}
          <div className="mt-2 flex flex-col gap-4">
            {PLAYLIST_GROUPS.map(({ group, ids }) => (
              <div key={group}>
                <div className="label mb-1 text-grey-500">{t(GROUP_LABEL[group])}</div>
                <OptionRow
                  options={ids.map((id) => ({
                    id,
                    label: t(`playlist.${id}` as StringKey),
                    hint:
                      PLAYLISTS[id].source.kind === "chart"
                        ? t("chartHint")
                        : undefined,
                  }))}
                  value={room.config.playlist}
                  disabled={!isHost}
                  columns={5}
                  narrowColumns={1}
                  onSelect={(playlist) => patch({ playlist: playlist as PlaylistId })}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>{t("difficulty")}</FieldLabel>
          <OptionRow
            options={DIFFICULTY_ORDER.map((id) => ({
              id,
              label: t(DIFFICULTY_LABEL[id]),
              // The numbers are the point of the difficulty choice, so they sit
              // on the control rather than hiding in a tooltip.
              hint: `${DIFFICULTIES[id].clipMs / 1000}s · ×${DIFFICULTIES[id].multiplier}`,
            }))}
            value={room.config.difficulty}
            disabled={!isHost}
            onSelect={(difficulty) => patch({ difficulty: difficulty as DifficultyId })}
          />
        </div>

        <div>
          <FieldLabel>{t("rounds")}</FieldLabel>
          <OptionRow
            options={ROUND_OPTIONS.map((n) => ({ id: String(n), label: String(n) }))}
            value={String(room.config.roundCount)}
            disabled={!isHost}
            onSelect={(n) => patch({ roundCount: Number(n) })}
          />
        </div>

        {/* Browsers refuse to start audio without a gesture, so we take one here
            rather than losing the first round to silence. */}
        {!audioUnlocked && (
          <Button variant="outline" onClick={onUnlockAudio}>
            {t("unlockAudio")}
          </Button>
        )}
        {!audioUnlocked && (
          <p className="label -mt-4 text-grey-500">{t("unlockHint")}</p>
        )}

        {/* Deliberately not pushed to the bottom of the column: the left side
            grows with the player list, and mt-auto would drag the host's only
            action below the fold. */}
        <div className="grid grid-cols-[1fr_auto] gap-4">
          {isHost ? (
            <Button onClick={onStart} disabled={starting}>
              {starting ? t("loadingTracks") : t("startMatch")}
            </Button>
          ) : (
            <div className="label flex items-center border border-grey-300 px-6 py-4 text-grey-500">
              {t("waitingForHost")}
            </div>
          )}
          <Button variant="outline" onClick={onLeave} className="w-auto">
            {t("leave")}
          </Button>
        </div>
      </section>
    </div>
  );
}

type Option = { id: string; label: string; hint?: string };

/**
 * A row of hairline-separated cells: one is filled, the rest are outlined.
 *
 * `columns` forces a width so several rows stacked above each other share the
 * same column edges — which is the whole point of a modular grid, and does not
 * happen if each row simply sizes itself to how many options it holds.
 */
function OptionRow({
  options,
  value,
  onSelect,
  disabled,
  columns,
  narrowColumns,
}: {
  options: Option[];
  value: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  columns?: number;
  narrowColumns?: number;
}) {
  const cols = columns ?? options.length;
  const narrow = narrowColumns ?? (options.length % 2 === 0 ? 2 : options.length);
  // The black dividing lines are the container's own background, so a short row
  // in a fixed grid would show them as solid blocks. Blank white cells fill the
  // remainder — and are hidden on narrow screens, where the grid is a different
  // shape and would otherwise gain empty rows.
  const fillers = cols > 0 ? (cols - (options.length % cols)) % cols : 0;

  return (
    // The column count follows the number of options. A fixed four-column grid
    // leaves an empty cell for a three-option row, and because the black
    // dividing lines are the container's own background, that empty cell shows
    // up as a solid black block.
    <div
      className="option-row mt-2 grid gap-px bg-ink"
      style={{ "--cols": cols, "--cols-narrow": narrow } as CSSProperties}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onSelect(opt.id)}
            // Hover must not be listed after the active skin: it would repaint
            // the selected cell grey and hide which option is chosen.
            className={`px-3 py-4 text-left transition-colors ${
              active
                ? "bg-ink text-paper"
                : disabled
                  ? "cursor-not-allowed bg-paper text-grey-500"
                  : "bg-paper text-ink hover:bg-grey-100"
            }`}
          >
            <span className="label block">{opt.label}</span>
            {opt.hint && (
              <span
                className={`numeric label mt-1 block ${active ? "text-grey-300" : "text-grey-500"}`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
      {Array.from({ length: fillers }, (_, i) => (
        <div key={`filler-${i}`} aria-hidden className="hidden bg-paper sm:block" />
      ))}
    </div>
  );
}
