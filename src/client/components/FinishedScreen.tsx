"use client";

import { useMemo } from "react";
import type { RoomState } from "@/shared/types";
import { MODES } from "@/shared/modes";
import { computeMatchAwards } from "@/shared/awards";
import { useLang } from "@/client/i18n";
import { Button } from "./Button";
import { FieldLabel } from "./Shell";
import { SongRecap } from "./SongRecap";

export function FinishedScreen({
  room,
  playerId,
  previewingId,
  onTogglePreview,
  onPlayAgain,
  onBackToLobby,
  onLeave,
}: {
  room: RoomState;
  playerId: string | null;
  previewingId: string | null;
  onTogglePreview: (trackId: string, url: string) => void;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onLeave: () => void;
}) {
  const { t } = useLang();
  const isHost = room.hostId === playerId;
  const standings = [...room.players].sort((a, b) => b.score - a.score);
  const winner = standings[0];
  /**
   * In a co-op match every player holds the same number, so a ranked table of
   * eight identical scores would be a leaderboard of nobody. The headline
   * becomes the room's total and the list drops its ranks.
   */
  const shared = MODES[room.config.mode].shared;

  const awards = useMemo(
    () => (room.summary ? computeMatchAwards(room.summary, room.players, room.config.mode) : {}),
    [room.summary, room.players, room.config.mode],
  );

  return (
    <div className="flex flex-col gap-12">
      <div className="grid gap-12 md:grid-cols-12 md:gap-8">
        <section className="md:col-span-5">
          <FieldLabel>{shared ? t("teamScore") : t("finalScore")}</FieldLabel>
          {winner && (
            <>
              <div
                className="numeric mt-4 font-bold leading-[0.8]"
                style={{ fontSize: "var(--text-display)" }}
              >
                {winner.score}
              </div>
              <p
                className="mt-4 font-semibold"
                style={{ fontSize: "var(--text-title)" }}
              >
                {shared ? t("teamName") : winner.name}
              </p>
            </>
          )}

          {/* Play again keeps the settings; back to the lobby is how you change
              them without everyone leaving and passing a new room code around. */}
          <div className="mt-10 grid gap-4">
            {isHost && (
              <>
                <Button onClick={onPlayAgain}>{t("playAgain")}</Button>
                <Button variant="outline" onClick={onBackToLobby}>
                  {t("backToLobby")}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onLeave}>
              {t("leave")}
            </Button>
          </div>
        </section>

        <section className="md:col-span-7">
          <FieldLabel>{shared ? t("players") : t("standings")}</FieldLabel>
          <ol className="mt-2">
            {standings.map((p, i) => (
              <li
                key={p.id}
                className="grid grid-cols-[2rem_1fr_auto] items-start gap-4 border-b border-grey-300 py-4"
              >
                <span className="numeric label text-grey-500 pt-0.5">
                  {shared ? "" : String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span
                    className={!shared && i === 0 ? "font-semibold" : ""}
                    style={{ fontSize: "var(--text-body)" }}
                  >
                    {p.name}
                    {p.id === playerId ? ` · ${t("you")}` : ""}
                  </span>
                  {(() => {
                    const playerAwards = awards[p.id];
                    if (!playerAwards || playerAwards.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {playerAwards.map((award) => (
                          <span
                            key={award.id}
                            title={t(`award.${award.id}.desc` as any)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-accent border border-accent/40 bg-paper px-1.5 py-0.5"
                          >
                            <span>★ {t(`award.${award.id}` as any)}</span>
                            {award.value != null && (
                              <span className="opacity-75 font-normal">({award.value})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <span
                  className="numeric font-semibold pt-0.5"
                  style={{ fontSize: "var(--text-body)" }}
                >
                  {shared ? "" : p.score}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {room.summary && (
        <SongRecap
          summary={room.summary}
          playerId={playerId}
          previewingId={previewingId}
          onToggle={onTogglePreview}
        />
      )}
    </div>
  );
}
