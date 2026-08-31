"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomState } from "@/shared/types";
import { DIFFICULTIES } from "@/shared/difficulty";
import { HEARDLE_MAX_WRONG, MODES } from "@/shared/modes";
import { heardleTierPoints } from "@/shared/scoring";
import { useLang } from "@/client/i18n";
import type { RoundOutcome } from "@/client/useGame";
import { RoundTimer } from "./RoundTimer";
import { RoundDots } from "./RoundDots";
import { PlayerStrip } from "./PlayerStrip";
import { FieldLabel } from "./Shell";

/**
 * The Round in progress. Everyone in the room sees exactly this at the same
 * time; nothing here reveals what anyone else picked, only how many have picked.
 *
 * Heardle changes two things about that. An option can come back struck out
 * mid-round, and in the co-op mode the strikes belong to the whole room — so
 * the grid has to show which options are gone as well as which one this player
 * chose.
 */
export function PlayScreen({
  room,
  playerId,
  history,
  strikes,
  serverNow,
  onAnswer,
}: {
  room: RoomState;
  playerId: string | null;
  history: RoundOutcome[];
  /** This player's own wrong guesses this Round. Empty outside Heardle. */
  strikes: string[];
  serverNow: () => number;
  onAnswer: (index: number, choiceId: string) => void;
}) {
  const { t } = useLang();
  const round = room.round;
  const roundIndex = round?.index ?? -1;

  // Which option this player tapped. The server never tells anyone what anyone
  // else picked before the reveal, so our own choice is only known locally.
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [roundIndex]);

  // Struck options: this player's own, plus the room's in a shared mode.
  const teamStrikes = round?.strikes ?? [];
  const struck = useMemo(
    () => new Set([...strikes, ...teamStrikes]),
    // The arrays are rebuilt on every snapshot, so compare their contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strikes.join("|"), teamStrikes.join("|")],
  );

  if (!round) return null;

  const staged = round.stagesMs.length > 0;
  const shared = MODES[room.config.mode].shared;
  const loading = room.phase === "loading";
  const myAnswer = Boolean(playerId && room.answeredPlayerIds.includes(playerId));
  /**
   * A tap is held locally only until the server rules on it. In Quiz that is
   * forever, because the first answer is final; in Heardle a wrong one comes
   * back struck and the option is released so the player can pick again.
   */
  const pending = picked && !struck.has(picked) ? picked : null;
  const locked = myAnswer || pending !== null;
  const guessesLeft = HEARDLE_MAX_WRONG - struck.size;

  /**
   * In artist mode every option is by the same act, so the artist line carries
   * no information — and worse, it leaks: a collaboration is credited under the
   * lead artist's id but displayed as "X & Y", which makes that one option
   * visibly different from the rest.
   */
  const showArtist = room.config.source.kind !== "artist";

  const multiplier = DIFFICULTIES[room.config.difficulty].multiplier;
  const tierPoints = round.stagesMs.map((_, i) =>
    heardleTierPoints(i, round.stagesMs.length, multiplier),
  );

  const status = myAnswer
    ? struck.size >= HEARDLE_MAX_WRONG && staged
      ? t("outOfGuesses")
      : t("waitingOthers")
    : struck.size > 0
      ? t("keepListening")
      : null;

  return (
    <div className="flex flex-col gap-8">
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
              stagesMs={staged ? round.stagesMs : undefined}
              tierPoints={staged ? tierPoints : undefined}
              serverNow={serverNow}
              idle={loading}
            />
          </div>

          {/* Only Heardle has guesses to spend, and how many are left is the
              whole tension of the co-op mode. */}
          {staged && !myAnswer && (
            <p className="label mt-6 flex items-baseline justify-between gap-4 border-t border-grey-300 pt-3">
              <span className="text-grey-500">
                {shared ? t("guessesLeftTeam") : t("guessesLeft")}
              </span>
              <span className="numeric font-semibold">{Math.max(guessesLeft, 0)}</span>
            </p>
          )}

          <div className="mt-8">
            <RoundDots
              total={round.total}
              current={round.index}
              history={history}
            />
          </div>

          {status && <p className="label mt-8 text-grey-500">{status}</p>}
        </section>

        <section className="md:col-span-8">
          <FieldLabel>{t("whichSong")}</FieldLabel>

          {/* Two by two at every width. Stacking these on a phone pushes the
              fourth option below the fold, which means scrolling while the clock
              runs — so the grid holds and the type shrinks instead. */}
          <div className="mt-2 grid grid-cols-2 gap-px bg-ink">
            {round.choices.map((choice) => {
              const isPicked = pending === choice.id;
              const isStruck = struck.has(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={loading || locked || isStruck}
                  aria-pressed={isPicked}
                  onClick={() => {
                    // Locked in immediately: showing that instantly is better
                    // than waiting for the broadcast to come back.
                    if (locked) return;
                    setPicked(choice.id);
                    onAnswer(round.index, choice.id);
                  }}
                  // Hover must stay clearly weaker than the locked-in state.
                  // When both were solid ink, the tile under a cursor left over
                  // from the previous round looked exactly like an answer this
                  // player had already committed to.
                  className={`group flex min-h-32 flex-col justify-between p-3 text-left transition-colors md:min-h-44 md:p-4 ${
                    isPicked
                      ? "bg-ink text-paper"
                      : isStruck
                        ? // A deeper wash than the grey-100 hover, on purpose:
                          // a live tile under a leftover cursor must never be
                          // mistakable for one that is already gone.
                          "bg-grey-300 text-grey-500"
                        : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                  }`}
                >
                  <span
                    className={`text-[0.9375rem] font-medium break-words md:text-[length:var(--text-body)] ${
                      isStruck ? "line-through decoration-1" : ""
                    }`}
                  >
                    {choice.title}
                  </span>
                  {isStruck ? (
                    <span className="label mt-3 text-ink md:mt-4">{t("struckOut")}</span>
                  ) : (
                    showArtist && (
                      <span
                        className={`label mt-3 md:mt-4 ${
                          isPicked ? "text-grey-300" : "text-grey-500"
                        }`}
                      >
                        {choice.artist}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <PlayerStrip room={room} playerId={playerId} />
    </div>
  );
}
