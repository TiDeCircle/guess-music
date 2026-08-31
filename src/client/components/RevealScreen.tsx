"use client";

import type { RoomState } from "@/shared/types";
import { MODES } from "@/shared/modes";
import { useLang } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/**
 * The moment the whole Lockstep design exists for: every player finds out at
 * the same instant. Correct and wrong are told apart by weight and a
 * strikethrough, not by colour.
 */
export function RevealScreen({ room, playerId }: { room: RoomState; playerId: string | null }) {
  const { t } = useLang();
  const reveal = room.reveal;
  if (!reveal) return null;

  const byId = new Map(room.players.map((p) => [p.id, p]));
  // A co-op round is one result wearing eight names: everyone scored the same
  // thing off the same guess, so it is reported once, as the room.
  const shared = MODES[room.config.mode].shared;
  const rows = shared
    ? reveal.results.slice(0, 1)
    : [...reveal.results].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-6">
        <FieldLabel>{t("theAnswer")}</FieldLabel>
        <div className="mt-4 flex items-start gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reveal.track.artworkUrl}
            alt=""
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 border border-ink object-cover md:h-40 md:w-40"
          />
          <div>
            <h2
              className="font-bold leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "var(--text-title)" }}
            >
              {reveal.track.title}
            </h2>
            <p className="label mt-3 text-grey-500">{reveal.track.artist}</p>
          </div>
        </div>
      </section>

      <section className="md:col-span-6">
        <FieldLabel>{shared ? t("teamScore") : t("standings")}</FieldLabel>
        <ul className="mt-2">
          {rows.map((r) => {
            const player = byId.get(r.playerId);
            if (!player) return null;
            const answered = r.choiceId !== null;
            return (
              <li
                key={r.playerId}
                className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 border-b border-grey-300 py-3"
              >
                <span
                  className={
                    r.correct
                      ? "font-semibold"
                      : answered
                        ? "text-grey-500 line-through decoration-1"
                        : "text-grey-300"
                  }
                  style={{ fontSize: "var(--text-body)" }}
                >
                  {shared ? t("teamName") : player.name}
                  {!shared && r.playerId === playerId ? ` · ${t("you")}` : ""}
                </span>
                <span className="label text-grey-500">
                  {r.correct ? t("correct") : answered ? t("wrong") : t("noAnswer")}
                </span>
                <span className="numeric w-16 text-right font-semibold">
                  {r.gained > 0 ? `+${r.gained}` : "0"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
