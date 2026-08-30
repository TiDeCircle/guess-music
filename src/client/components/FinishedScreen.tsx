"use client";

import type { RoomState } from "@/shared/types";
import { useLang } from "@/client/i18n";
import { Button } from "./Button";
import { FieldLabel } from "./Shell";

export function FinishedScreen({
  room,
  playerId,
  onPlayAgain,
  onLeave,
}: {
  room: RoomState;
  playerId: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const { t } = useLang();
  const isHost = room.hostId === playerId;
  const standings = [...room.players].sort((a, b) => b.score - a.score);
  const winner = standings[0];

  return (
    <div className="grid gap-12 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-5">
        <FieldLabel>{t("finalScore")}</FieldLabel>
        {winner && (
          <>
            <div
              className="numeric mt-4 font-bold leading-[0.8]"
              style={{ fontSize: "var(--text-display)" }}
            >
              {winner.score}
            </div>
            <p className="mt-4 font-semibold" style={{ fontSize: "var(--text-title)" }}>
              {winner.name}
            </p>
          </>
        )}

        <div className="mt-10 grid gap-4">
          {isHost && <Button onClick={onPlayAgain}>{t("playAgain")}</Button>}
          <Button variant="outline" onClick={onLeave}>
            {t("leave")}
          </Button>
        </div>
      </section>

      <section className="md:col-span-7">
        <FieldLabel>{t("standings")}</FieldLabel>
        <ol className="mt-2">
          {standings.map((p, i) => (
            <li
              key={p.id}
              className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-grey-300 py-4"
            >
              <span className="numeric label text-grey-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={i === 0 ? "font-semibold" : ""}
                style={{ fontSize: "var(--text-body)" }}
              >
                {p.name}
                {p.id === playerId ? ` · ${t("you")}` : ""}
              </span>
              <span className="numeric font-semibold" style={{ fontSize: "var(--text-body)" }}>
                {p.score}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
