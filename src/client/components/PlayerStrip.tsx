"use client";

import type { RoomState } from "@/shared/types";
import { useLang } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/** Keys for the empty cells needed to complete a row of `columns`. */
function blanks(count: number, columns: number): string[] {
  const missing = (columns - (count % columns)) % columns;
  return Array.from({ length: missing }, (_, i) => `blank-${columns}-${i}`);
}

/**
 * Everyone in the room, live, while the Round runs.
 *
 * Who has locked an answer in is the one thing that makes a Lockstep round feel
 * like a race — without it a player stares at four options with no sense that
 * anyone else is there. What they picked stays hidden until the reveal; only
 * that they have picked is shown.
 */
export function PlayerStrip({
  room,
  playerId,
}: {
  room: RoomState;
  playerId: string | null;
}) {
  const { t } = useLang();
  const answered = new Set(room.answeredPlayerIds);
  const ready = new Set(room.readyPlayerIds);
  const loading = room.phase === "loading";
  const ordered = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <section>
      <FieldLabel>{t("players")}</FieldLabel>
      <div className="mt-2 grid grid-cols-2 gap-px bg-ink sm:grid-cols-4">
        {ordered.map((p) => {
          const done = loading ? ready.has(p.id) : answered.has(p.id);
          return (
            // Filled rather than blinked: a cell that fills reads as another
            // person doing something, and a cell that snaps reads as a glitch.
            <div
              key={p.id}
              className={`flex items-baseline justify-between gap-2 p-3 transition-colors ${
                done ? "bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
              <span
                className={`truncate ${p.connected ? "" : "line-through opacity-50"}`}
                style={{ fontSize: "var(--text-body)" }}
              >
                {p.name}
                {p.id === playerId ? ` · ${t("you")}` : ""}
              </span>
              <span className="numeric label shrink-0">{p.score}</span>
            </div>
          );
        })}
        {/* The black dividing lines are the container's own background, so an
            unfilled cell shows up as a solid block. Rooms hold two to eight
            players against a grid of four, and of two on a phone, so both
            shapes need their own padding. */}
        {blanks(ordered.length, 4).map((k) => (
          <div key={k} aria-hidden className="hidden bg-paper sm:block" />
        ))}
        {blanks(ordered.length, 2).map((k) => (
          <div key={k} aria-hidden className="bg-paper sm:hidden" />
        ))}
      </div>
    </section>
  );
}
