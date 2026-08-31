"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "@/shared/types";
import { DIFFICULTIES } from "@/shared/difficulty";
import { MODES } from "@/shared/modes";
import { heardleTierPoints } from "@/shared/scoring";
import { useLang } from "@/client/i18n";
import type { RoundOutcome } from "@/client/useGame";
import { RoundTimer } from "./RoundTimer";
import { RoundDots } from "./RoundDots";
import { PlayerStrip } from "./PlayerStrip";
import { SongSearch } from "./SongSearch";
import { UnlockLadder } from "./UnlockLadder";
import { VinylRecord } from "./VinylRecord";
import { FieldLabel } from "./Shell";

/**
 * The Round in progress. Everyone in the room is on the same clock; nothing
 * here reveals what anyone else has done, only how far they have got.
 *
 * The two modes answer differently enough to be two screens: Quiz is a grid of
 * four options and one tap, Heardle is a ladder you spend and a title you type.
 * What they share is the frame — round number, clock, player strip — so a room
 * switching modes still recognises where it is.
 */
export function PlayScreen({
  room,
  playerId,
  history,
  wrongGuesses,
  level,
  serverNow,
  onAnswer,
  onUnlock,
  onReplay,
}: {
  room: RoomState;
  playerId: string | null;
  history: RoundOutcome[];
  /** Titles this player has already tried and had rejected. */
  wrongGuesses: string[];
  /** How far the clip is unlocked for this player, or for the room. */
  level: number;
  serverNow: () => number;
  onAnswer: (index: number, guess: string) => void;
  onUnlock: (index: number) => void;
  onReplay: () => void;
}) {
  const { t } = useLang();
  const round = room.round;
  const roundIndex = round?.index ?? -1;

  // Which option this player tapped. The server never tells anyone what anyone
  // else picked before the reveal, so our own choice is only known locally.
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [roundIndex]);

  // The Round is live a beat before the clip is, so everyone gets the same
  // moment to look up. The server refuses answers through it either way; this
  // is what stops a tap into that beat looking like it was dropped.
  const startAt = round?.startAt ?? 0;
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const wait = startAt - serverNow();
    if (wait <= 0) {
      setArmed(true);
      return;
    }
    setArmed(false);
    const lead = setTimeout(() => setArmed(true), wait);
    return () => clearTimeout(lead);
  }, [startAt, serverNow]);

  /**
   * Answer with the number keys.
   *
   * A Quiz round is a race against a clock, and moving a hand to a mouse and
   * back costs more of it than reading the options does. The numerals on the
   * tiles are what makes this discoverable rather than a secret.
   *
   * Sits with the other hooks, above the early return, so the guards it needs
   * are re-derived here rather than read from further down the component.
   */
  useEffect(() => {
    if (!round || MODES[room.config.mode].typed) return;
    if (room.phase === "loading" || !armed || picked !== null) return;
    if (playerId && room.answeredPlayerIds.includes(playerId)) return;

    const onKey = (event: KeyboardEvent) => {
      // A shortcut that fires while someone is typing their name into a field
      // is a bug, and a modifier combination belongs to the browser.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;

      const index = Number(event.key) - 1;
      const choice = round.choices[index];
      if (!Number.isInteger(index) || index < 0 || !choice) return;
      event.preventDefault();
      setPicked(choice.id);
      onAnswer(round.index, choice.id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round, room, armed, picked, playerId, onAnswer]);

  /**
   * Whether the clip is audible, for the record.
   *
   * Two timeouts rather than a frame loop: this changes twice in a Round, and a
   * requestAnimationFrame running the length of a clip to flip one boolean
   * would be a second animation loop on a screen that already has one.
   */
  const audibleMs =
    round === null
      ? 0
      : round.stagesMs.length > 0
        ? (round.stagesMs[level] ?? round.clipMs)
        : round.clipMs;
  const [sounding, setSounding] = useState(false);
  useEffect(() => {
    if (!round) return;
    const now = serverNow();
    const startsIn = round.startAt - now;
    const endsIn = round.startAt + audibleMs - now;
    setSounding(startsIn <= 0 && endsIn > 0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (startsIn > 0) timers.push(setTimeout(() => setSounding(true), startsIn));
    if (endsIn > 0) timers.push(setTimeout(() => setSounding(false), endsIn));
    return () => timers.forEach(clearTimeout);
  }, [round, audibleMs, serverNow]);

  if (!round) return null;

  const mode = MODES[room.config.mode];
  const loading = room.phase === "loading";
  /** Nothing is answerable until the audio is buffered *and* the clip is on. */
  const waiting = loading || !armed;
  const done = Boolean(playerId && room.answeredPlayerIds.includes(playerId));
  const multiplier = DIFFICULTIES[room.config.difficulty].multiplier;
  const tierPoints = round.stagesMs.map((_, i) =>
    heardleTierPoints(i, round.stagesMs.length, multiplier),
  );

  return (
    // Keyed by round so the entrance re-fires each time, rather than only on
    // the first mount of the match.
    // `flex-1` all the way down is what stops the round sitting in the top
    // half of a tall screen with nothing under it. The shell already offers the
    // height; nothing here was claiming it.
    <div key={round.index} className="enter flex flex-1 flex-col gap-8">
      <div className="grid flex-1 gap-8 md:grid-cols-12">
        <section className="flex flex-col md:col-span-4">
          <FieldLabel>
            {t("round")} {round.index + 1} / {round.total}
          </FieldLabel>

          <div className="mt-4">
            <RoundTimer
              startAt={round.startAt}
              deadlineAt={round.deadlineAt}
              clipMs={round.clipMs}
              windowMs={round.answerWindowMs}
              // In Heardle the clip length is whatever this player has bought,
              // so the "music playing" marker follows the ladder, not the plan.
              audibleMs={round.stagesMs.length > 0 ? round.stagesMs[level] : undefined}
              serverNow={serverNow}
              idle={loading}
            />
          </div>

          {mode.typed && (
            <div className="mt-8">
              <UnlockLadder
                stagesMs={round.stagesMs}
                tierPoints={tierPoints}
                level={level}
                shared={mode.shared}
                canUnlock={!waiting && !done}
                onUnlock={() => onUnlock(round.index)}
                onReplay={onReplay}
              />
            </div>
          )}

          <div className="mt-8">
            <RoundDots total={round.total} current={round.index} history={history} />
          </div>

          {/* Turning while there is sound, still while there is not. Takes
              whatever height the column has left rather than a fixed size, so
              it fills the space under the dots instead of leaving it empty —
              capped, because a record the height of a desktop window is a
              poster, not a detail. Hidden on a phone, where that space is the
              board's and the round has to fit above the fold. */}
          <div className="mt-8 hidden flex-1 items-start justify-center md:flex">
            <div className="aspect-square w-full max-w-[16rem]">
              <VinylRecord spinning={sounding} />
            </div>
          </div>

          {done && (
            <p className="label mt-8 text-grey-500">
              {mode.shared ? t("roundOverForRoom") : t("waitingOthers")}
            </p>
          )}
        </section>

        <section className="flex flex-col md:col-span-8">
          <FieldLabel>{t("whichSong")}</FieldLabel>

          {mode.typed ? (
            <div className="mt-4">
              <SongSearch
                key={round.index}
                disabled={waiting || done}
                // Our own rejected titles, plus the room's in a shared mode.
                wrongGuesses={[
                  ...round.tried,
                  ...wrongGuesses.filter((g) => !round.tried.includes(g)),
                ]}
                onGuess={(title) => onAnswer(round.index, title)}
              />
              {!done && (
                <p className="label mt-6 leading-relaxed text-grey-500">
                  {mode.shared ? t("coopWaiting") : t("typeHint")}
                </p>
              )}
            </div>
          ) : (
            // Two by two at every width. Stacking these on a phone pushes the
            // fourth option below the fold, which means scrolling while the
            // clock runs — so the grid holds and the type shrinks instead.
            <div className="mt-2 grid flex-1 grid-cols-2 grid-rows-2 gap-px bg-ink">
              {round.choices.map((choice, i) => {
                const isPicked = picked === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={waiting || done || picked !== null}
                    aria-pressed={isPicked}
                    onClick={() => {
                      // Locked in immediately: an answer is final, and showing
                      // that instantly beats waiting for the broadcast.
                      if (picked) return;
                      setPicked(choice.id);
                      onAnswer(round.index, choice.id);
                    }}
                    // Hover must stay clearly weaker than the locked-in state.
                    // When both were solid ink, the tile under a cursor left
                    // over from the previous round looked exactly like an answer
                    // this player had already committed to.
                    //
                    // Timing is deliberately lopsided. The tile you chose
                    // confirms at press speed, because that is your own hand
                    // landing; the three you did not choose take the slower
                    // beat to fall back, because that is the screen answering.
                    // Symmetric timing here made the whole grid feel like it
                    // changed by itself.
                    className={`group flex min-h-32 flex-col justify-between gap-3 p-3 text-left transition-colors md:min-h-44 md:p-4 ${
                      isPicked
                        ? "bg-ink text-paper duration-[var(--duration-press)]"
                        : picked !== null
                          ? "bg-grey-100 text-grey-500 duration-[var(--duration-enter)]"
                          : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                    }`}
                  >
                    {/* The number this option answers to on the keyboard. It
                        also gives the tile something in its top corner to hold
                        it together — since the artist line came off, a title
                        alone was floating in a very large box. */}
                    <span
                      className={`numeric label transition-colors ${
                        isPicked ? "text-grey-300" : "text-grey-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {/* Between two of the design's four sizes rather than a
                        fifth one: body on a phone, the title size on a wide
                        screen, and nothing in between that is not one of them
                        interpolated. */}
                    <span
                      className="font-medium text-pretty break-words"
                      style={{
                        fontSize:
                          "clamp(var(--text-body), 2.2vw, var(--text-title))",
                        lineHeight: 1.15,
                      }}
                    >
                      {choice.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PlayerStrip room={room} playerId={playerId} />
    </div>
  );
}
