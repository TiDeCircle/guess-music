"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "@/shared/types";
import { useLang } from "@/client/i18n";
import { Countdown } from "./Countdown";
import { FieldLabel } from "./Shell";

/**
 * The Round in progress. Everyone in the room sees exactly this at the same
 * time; nothing here reveals what anyone else picked, only how many have picked.
 */
export function PlayScreen({
  room,
  playerId,
  serverNow,
  onAnswer,
}: {
  room: RoomState;
  playerId: string | null;
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
  const connectedCount = room.players.filter((p) => p.connected).length;

  return (
    <div className="grid gap-8 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-4">
        <FieldLabel>
          {t("round")} {round.index + 1} / {round.total}
        </FieldLabel>

        <div className="mt-4 md:mt-6">
          {loading ? (
            <>
              <div
                className="numeric leading-[0.8] font-semibold text-grey-300"
                style={{ fontSize: "clamp(3.5rem, 14vw, var(--text-display))" }}
              >
                —
              </div>
              <p className="label mt-4 text-grey-500">{t("loadingAudio")}</p>
            </>
          ) : (
            <Countdown
              startAt={round.startAt}
              deadlineAt={round.deadlineAt}
              serverNow={serverNow}
            />
          )}
        </div>

        <p className="label mt-6 text-grey-500 md:mt-8">
          {t("answered")} {room.answeredPlayerIds.length}/{connectedCount}
          {myAnswer ? ` · ${t("waitingOthers")}` : ""}
        </p>
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
                  // Locked in immediately: an answer is final, and showing that
                  // instantly is better than waiting for the state broadcast.
                  if (picked) return;
                  setPicked(choice.id);
                  onAnswer(round.index, choice.id);
                }}
                className={`group flex min-h-32 flex-col justify-between p-3 text-left transition-colors md:min-h-40 md:p-4 ${
                  isPicked
                    ? "bg-ink text-paper"
                    : "bg-paper text-ink enabled:hover:bg-ink enabled:hover:text-paper disabled:text-grey-500"
                }`}
              >
                <span className="text-[0.9375rem] font-medium break-words md:text-[length:var(--text-body)]">
                  {choice.title}
                </span>
                <span
                  className={`label mt-3 md:mt-4 ${
                    isPicked ? "text-grey-300" : "text-grey-500 group-enabled:group-hover:text-grey-300"
                  }`}
                >
                  {choice.artist}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
