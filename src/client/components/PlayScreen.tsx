"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "@/shared/types";
import { useLang } from "@/client/i18n";
import type { RoundOutcome } from "@/client/useGame";
import { RoundTimer } from "./RoundTimer";
import { RoundDots } from "./RoundDots";
import { PlayerStrip } from "./PlayerStrip";
import { FieldLabel } from "./Shell";

/**
 * The Round in progress. Everyone in the room sees exactly this at the same
 * time; nothing here reveals what anyone else picked, only how many have picked.
 */
export function PlayScreen({
  room,
  playerId,
  history,
  serverNow,
  onAnswer,
}: {
  room: RoomState;
  playerId: string | null;
  history: RoundOutcome[];
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

  if (!round) return null;

  const loading = room.phase === "loading";
  const myAnswer = playerId && room.answeredPlayerIds.includes(playerId);
  /**
   * In artist mode every option is by the same act, so the artist line carries
   * no information — and worse, it leaks: a collaboration is credited under the
   * lead artist's id but displayed as "X & Y", which makes that one option
   * visibly different from the rest.
   */
  const showArtist = room.config.source.kind !== "artist";

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
              serverNow={serverNow}
              idle={loading}
            />
          </div>

          <div className="mt-8">
            <RoundDots
              total={round.total}
              current={round.index}
              history={history}
            />
          </div>

          {myAnswer && (
            <p className="label mt-8 text-grey-500">{t("waitingOthers")}</p>
          )}
        </section>

        <section className="md:col-span-8">
          <FieldLabel>{t("whichSong")}</FieldLabel>

          {/* Two by two at every width. Stacking these on a phone pushes the
              fourth option below the fold, which means scrolling while the clock
              runs — so the grid holds and the type shrinks instead. */}
          <div className="mt-2 grid grid-cols-2 gap-px bg-ink">
            {round.choices.map((choice) => {
              const isPicked = picked === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={loading || Boolean(myAnswer)}
                  aria-pressed={isPicked}
                  onClick={() => {
                    // Locked in immediately: an answer is final, and showing
                    // that instantly is better than waiting for the broadcast.
                    if (picked) return;
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
                      : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                  }`}
                >
                  <span className="text-[0.9375rem] font-medium break-words md:text-[length:var(--text-body)]">
                    {choice.title}
                  </span>
                  {showArtist && (
                    <span
                      className={`label mt-3 md:mt-4 ${
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
        </section>
      </div>

      <PlayerStrip room={room} playerId={playerId} />
    </div>
  );
}
