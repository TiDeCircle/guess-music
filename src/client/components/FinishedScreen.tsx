"use client";

import type { RoomState } from "@/shared/types";
import { MODES } from "@/shared/modes";
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
                className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-grey-300 py-4"
              >
                <span className="numeric label text-grey-500">
                  {shared ? "" : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={!shared && i === 0 ? "font-semibold" : ""}
                  style={{ fontSize: "var(--text-body)" }}
                >
                  {p.name}
                  {p.id === playerId ? ` · ${t("you")}` : ""}
                </span>
                <span
                  className="numeric font-semibold"
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
