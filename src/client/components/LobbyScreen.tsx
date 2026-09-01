"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { DifficultyId, MatchConfig, RoomState } from "@/shared/types";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/shared/difficulty";
import { MAX_PLAYERS } from "@/shared/protocol";
import { useLang, type StringKey } from "@/client/i18n";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { FieldLabel } from "./Shell";
import { ModePicker } from "./ModePicker";
import { PlaylistPicker } from "./PlaylistPicker";

const DIFFICULTY_LABEL: Record<DifficultyId, StringKey> = {
  easy: "difficultyEasy",
  medium: "difficultyMedium",
  hard: "difficultyHard",
  extreme: "difficultyExtreme",
};

const ROUND_OPTIONS = [5, 10, 15];

/** The three questions a match needs answered, in the order they matter. */
const STEPS = ["stepMode", "stepSongs", "stepSettings"] as const satisfies readonly StringKey[];

export function LobbyScreen({
  room,
  playerId,
  audioUnlocked,
  onUnlockAudio,
  onConfig,
  onLock,
  onStart,
  onKick,
  onSetMuted,
  starting,
}: {
  room: RoomState;
  playerId: string | null;
  audioUnlocked: boolean;
  onUnlockAudio: () => void;
  onConfig: (config: MatchConfig) => void;
  onLock: (locked: boolean) => void;
  onStart: () => void;
  onKick: (playerId: string) => void;
  onSetMuted: (playerId: string, muted: boolean) => void;
  starting: boolean;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  /**
   * Which setup step the host is on. Deliberately local: it is where one person
   * is looking, not something the room needs to agree on, and syncing it would
   * yank seven other screens around every time the host changed their mind.
   */
  const [step, setStep] = useState(0);
  const isHost = room.hostId === playerId;
  /** Who a kick is pending confirmation for, if anyone. */
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);

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

        {/* Locking hides the room from the home page without sealing it, so the
            code a host already sent still works. */}
        <div className="mt-6 border-t border-ink pt-3">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="label">{t("lockRoom")}</span>
            <input
              type="checkbox"
              checked={room.locked}
              disabled={!isHost}
              onChange={(e) => onLock(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`flex h-6 w-11 shrink-0 items-center border border-ink p-px transition-colors ${
                room.locked ? "bg-ink" : "bg-paper"
              } ${isHost ? "" : "opacity-40"}`}
            >
              <span
                className={`h-full w-1/2 transition-transform ${
                  room.locked ? "translate-x-full bg-paper" : "bg-ink"
                }`}
              />
            </span>
          </label>
          <p className="label mt-2 text-grey-500">
            {room.locked ? t("lockedHint") : t("listedHint")}
          </p>
        </div>

        <div className="mt-10">
          <FieldLabel>
            {t("players")} — {room.players.length}/{MAX_PLAYERS}
          </FieldLabel>
          <ul className="mt-2">
            {room.players.map((p) => {
              // The host cannot moderate themselves — there is nothing to
              // kick or mute a person out of their own seat for.
              const canModerate = isHost && p.id !== playerId;
              return (
                <li
                  key={p.id}
                  className="flex items-baseline justify-between gap-3 border-b border-grey-300 py-3"
                  style={{ fontSize: "var(--text-body)" }}
                >
                  <span
                    className={`flex min-w-0 items-center gap-2 ${p.connected ? "" : "text-grey-300 line-through"}`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.muted && (
                      <span className="label shrink-0 border border-accent px-1 py-0.5 text-[10px] text-accent">
                        {t("muted")}
                      </span>
                    )}
                  </span>
                  <span className="label flex shrink-0 items-center gap-3 text-grey-500">
                    {/* Joined here rather than concatenated: a non-host looking
                        at their own row used to get a separator with nothing
                        in front of it. */}
                    {[p.id === room.hostId ? t("host") : "", p.id === playerId ? t("you") : ""]
                      .filter(Boolean)
                      .join(" · ")}
                    {canModerate && (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSetMuted(p.id, !p.muted)}
                          className="press font-mono text-[10px] uppercase tracking-wider hover:text-accent"
                        >
                          {p.muted ? t("unmute") : t("mute")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setKickTarget({ id: p.id, name: p.name })}
                          className="press font-mono text-[10px] uppercase tracking-wider hover:text-accent"
                        >
                          {t("kick")}
                        </button>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-8 md:col-span-7">
        {/* Everyone gets the same navigator, host or not — a player who
            cannot change the match still wants to see what it is before it
            starts, not four lines of text standing in for the real thing.
            Only the leaf that would commit a choice is host-gated; the
            tabs, the group tiles and the artist search stay live for
            anyone browsing. */}
        <Stepper current={step} onGo={setStep} />

        {step === 0 && (
          <ModePicker
            value={room.config.mode}
            disabled={!isHost}
            onSelect={(mode) => patch({ mode })}
          />
        )}

        {step === 1 && (
          <PlaylistPicker
            value={room.config.source}
            disabled={!isHost}
            onSelect={(source) => patch({ source })}
          />
        )}

        {step === 2 && (
          <>
            <div>
              <FieldLabel>{t("difficulty")}</FieldLabel>
              <OptionRow
                options={DIFFICULTY_ORDER.map((id) => ({
                  id,
                  label: t(DIFFICULTY_LABEL[id]),
                  hint: (
                    <span className="flex items-center gap-2">
                      <ClipBar clipMs={DIFFICULTIES[id].clipMs} />
                      <span className="numeric">×{DIFFICULTIES[id].multiplier}</span>
                    </span>
                  ),
                }))}
                value={room.config.difficulty}
                disabled={!isHost}
                onSelect={(difficulty) =>
                  patch({ difficulty: difficulty as DifficultyId })
                }
              />
            </div>

            <div>
              <FieldLabel>{t("rounds")}</FieldLabel>
              <OptionRow
                // Bare numbers sit directly under a difficulty row labelled
                // "15S · ×0.75" and get read as seconds. The unit is not
                // decoration.
                options={ROUND_OPTIONS.map((n) => ({
                  id: String(n),
                  label: `${n} ${t("roundsUnit")}`,
                }))}
                value={String(room.config.roundCount)}
                disabled={!isHost}
                onSelect={(n) => patch({ roundCount: Number(n) })}
              />
            </div>
          </>
        )}

        {/* Browsers refuse to start audio without a gesture, so we take one here
            rather than losing the first round to silence. */}
        {!audioUnlocked && (
          <div>
            <Button variant="outline" onClick={onUnlockAudio}>
              {t("unlockAudio")}
            </Button>
            <p className="label mt-2 text-grey-500">{t("unlockHint")}</p>
          </div>
        )}

        {/* Deliberately not pushed to the bottom of the column: the left side
            grows with the player list, and mt-auto would drag the host's only
            action below the fold.

            Grid, not flex: `Button` sets its own `w-full`, and only a grid's
            `auto` track sizes a 100%-wide child to its content — in a flex
            row that same child claims the row's full main size and only
            gives ground on the shrink pass, which is what let "←" balloon
            into a wide, mostly-empty box the one time this was flex. A third
            column opens up only on the steps that still show Next. */}
        <div
          className={`grid gap-4 ${
            isHost && step < STEPS.length - 1 ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-[auto_1fr]"
          }`}
        >
          {isHost ? (
            <>
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className="w-auto"
              >
                ←
              </Button>
              {/* Start is always reachable, not just on the last step: every
                  setting already has a default, so a host happy with them
                  should not have to click through steps they have no opinion
                  on. Next stays for a host who does. */}
              {step < STEPS.length - 1 && (
                <Button variant="outline" onClick={() => setStep((s) => s + 1)}>
                  {t("next")}
                </Button>
              )}
              <Button onClick={onStart} disabled={starting}>
                {starting ? t("loadingTracks") : t("startMatch")}
              </Button>
            </>
          ) : (
            <div className="label col-span-full flex items-center border border-grey-300 px-6 py-4 text-grey-500">
              {t("waitingForHost")}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={kickTarget !== null}
        title={kickTarget?.name}
        message={t("kickConfirm")}
        confirmLabel={t("kick")}
        cancelLabel={t("cancel")}
        onCancel={() => setKickTarget(null)}
        onConfirm={() => {
          if (kickTarget) onKick(kickTarget.id);
          setKickTarget(null);
        }}
      />
    </div>
  );
}

/**
 * Where the host is in setting the match up.
 *
 * The steps are numbered and stay clickable in both directions: this is a form
 * split into three, not a wizard that has to be walked, and a host who only
 * wants to change the difficulty should not have to page through the songs.
 */
function Stepper({
  current,
  onGo,
}: {
  current: number;
  onGo: (step: number) => void;
}) {
  const { t } = useLang();
  return (
    <div className="grid grid-cols-3 gap-px bg-ink">
      {STEPS.map((key, i) => {
        const active = i === current;
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={() => onGo(i)}
            className={`flex items-baseline gap-2 px-3 py-3 text-left transition-colors ${
              active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
            }`}
          >
            <span
              className={`numeric label ${active ? "text-grey-300" : "text-grey-500"}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="label">{t(key)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Longest clip on the scale, so the bars are read against each other. */
const LONGEST_CLIP_MS = Math.max(
  ...DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].clipMs),
);

/**
 * How much music a difficulty gives you, as a length rather than a number.
 *
 * The seconds used to be printed here, directly above a row of bare round
 * counts — "15S" over "15" — and the two got read as the same thing. A bar has
 * no unit to mistake, and comparing four lengths is the actual question being
 * asked.
 */
function ClipBar({ clipMs }: { clipMs: number }) {
  return (
    <span className="relative inline-block h-1 w-12 shrink-0" aria-hidden>
      {/* Both layers use currentColor, so the bar inverts with the cell when
          the option is selected without needing a second set of tokens. */}
      <span className="absolute inset-0 bg-current opacity-25" />
      <span
        className="absolute inset-y-0 left-0 bg-current"
        style={{ width: `${(clipMs / LONGEST_CLIP_MS) * 100}%` }}
      />
    </span>
  );
}

type Option = { id: string; label: string; hint?: ReactNode };

/** A row of hairline-separated cells: one is filled, the rest are outlined. */
function OptionRow({
  options,
  value,
  onSelect,
  disabled,
}: {
  options: Option[];
  value: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const cols = options.length;
  // Four options split two by two on a phone; an odd count stays on one line,
  // since those labels are short.
  const narrow = cols % 2 === 0 ? 2 : cols;

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
                className={`label mt-1 block ${active ? "text-grey-300" : "text-grey-500"}`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
