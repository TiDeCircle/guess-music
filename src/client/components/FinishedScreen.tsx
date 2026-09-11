"use client";

import { useMemo, useState } from "react";
import type { RoomState } from "@/shared/types";
import { MODES } from "@/shared/modes";
import { computeMatchAwards } from "@/shared/awards";
import { useLang } from "@/client/i18n";
import { shareMessage, shareUrl } from "@/shared/share";
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
}: {
  room: RoomState;
  playerId: string | null;
  previewingId: string | null;
  onTogglePreview: (trackId: string, url: string) => void;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  const { t, lang } = useLang();
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

  /**
   * What goes out when a player shares: how they did, and a link to the public
   * page for what they played — the way the game reaches people who have never
   * heard of it. In a shared mode every row carries the Room's result, so the
   * same count works for both.
   */
  const me = room.players.find((p) => p.id === playerId);
  const rounds = room.summary?.rounds ?? [];
  const correct = rounds.filter((r) =>
    r.results.some((x) => x.playerId === playerId && x.correct),
  ).length;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (!me) return;
    const text = shareMessage({
      lang,
      source: room.config.source,
      correct,
      total: rounds.length,
      score: me.score,
      team: shared,
    });
    const url = shareUrl(room.config.source);
    try {
      // A phone's own share sheet reaches LINE and whatever else is installed;
      // a browser without one puts the message on the clipboard instead.
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Closing the share sheet rejects too, and is no error to anyone.
    }
  };

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
              them without everyone leaving and passing a new room code around.
              Leaving lives in the header now, reachable from every screen. */}
          <div className="mt-10 grid gap-4">
            {isHost && (
              <>
                <Button onClick={onPlayAgain}>{t("playAgain")}</Button>
                <Button variant="outline" onClick={onBackToLobby}>
                  {t("backToLobby")}
                </Button>
              </>
            )}
            {me && rounds.length > 0 && (
              <Button variant="outline" onClick={() => void share()}>
                {copied ? t("copied") : t("shareResult")}
              </Button>
            )}
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
