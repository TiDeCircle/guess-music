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

  if (!round) return null;

  const mode = MODES[room.config.mode];
  const loading = room.phase === "loading";
  const done = Boolean(playerId && room.answeredPlayerIds.includes(playerId));
  const multiplier = DIFFICULTIES[room.config.difficulty].multiplier;
  const tierPoints = round.stagesMs.map((_, i) =>
    heardleTierPoints(i, round.stagesMs.length, multiplier),
  );

  /**
   * In artist mode every option is by the same act, so the artist line carries
   * no information — and worse, it leaks: a collaboration is credited under the
   * lead artist's id but displayed as "X & Y", which makes that one option
   * visibly different from the rest.
   */
  const showArtist = room.config.source.kind !== "artist";

  return (
    // Keyed by round so the entrance re-fires each time, rather than only on
    // the first mount of the match.
    <div key={round.index} className="enter flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-12">
        <section className="md:col-span-4">
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
                canUnlock={!loading && !done}
                onUnlock={() => onUnlock(round.index)}
                onReplay={onReplay}
              />
            </div>
          )}

          <div className="mt-8">
            <RoundDots total={round.total} current={round.index} history={history} />
          </div>

          {done && (
            <p className="label mt-8 text-grey-500">
              {mode.shared ? t("roundOverForRoom") : t("waitingOthers")}
            </p>
          )}
        </section>

        <section className="md:col-span-8">
          <FieldLabel>{t("whichSong")}</FieldLabel>

          {mode.typed ? (
            <div className="mt-4">
              <SongSearch
                key={round.index}
                disabled={loading || done}
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
            <div className="mt-2 grid grid-cols-2 gap-px bg-ink">
              {round.choices.map((choice) => {
                const isPicked = picked === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={loading || done || picked !== null}
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
                    className={`group flex min-h-32 flex-col justify-between p-3 text-left transition-colors md:min-h-44 md:p-4 ${
                      isPicked
                        ? "bg-ink text-paper duration-[var(--duration-press)]"
                        : picked !== null
                          ? "bg-grey-100 text-grey-500 duration-[var(--duration-enter)]"
                          : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                    }`}
                  >
                    <span className="text-[0.9375rem] font-medium break-words md:text-[length:var(--text-body)]">
                      {choice.title}
                    </span>
                    {showArtist && (
                      <span
                        className={`label mt-3 transition-colors md:mt-4 ${
                          isPicked ? "text-grey-300" : "text-grey-500"
                        }`}
                      >
                        {choice.artist}
                      </span>
                    )}
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
