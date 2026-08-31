"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { RoomState } from "@/shared/types";
import type { ReactionId } from "@/shared/protocol";
import { useLang } from "@/client/i18n";
import { answeredSummary } from "@/client/roundStatus";
import { prefersReducedMotion } from "@/client/motionPrefs";
import { FieldLabel } from "./Shell";

/** Keys for the empty cells needed to complete a row of `columns`. */
function blanks(count: number, columns: number): string[] {
  const missing = (columns - (count % columns)) % columns;
  return Array.from({ length: missing }, (_, i) => `blank-${columns}-${i}`);
}

/**
 * How many columns a room of this size should be drawn in.
 *
 * A fixed grid of four drew three empty boxes for somebody playing alone, which
 * is the loneliest a screen can look in a game about playing with friends. The
 * count is data, not a design decision, so the grid follows it — up to the four
 * (two on a phone) the layout was built around.
 */
const columnsFor = (players: number, most: number) =>
  Math.max(Math.min(players, most), 1);

/** Read one of the motion tokens, so script and stylesheet stay in step. */
function token(el: Element, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}

/**
 * Everyone in the room, live, while the Round runs.
 *
 * Who has locked an answer in is the one thing that makes a Lockstep round feel
 * like a race — without it a player stares at four options with no sense that
 * anyone else is there. What they picked stays hidden until the reveal; only
 * that they have picked is shown.
 *
 * Three things were already true here and drawn as though they were not. How
 * many people the room is still waiting on was a wall of cells you had to count
 * yourself. Somebody answering changed a colour but never said *just now*. And
 * the strip is sorted by score, so people really do overtake each other — the
 * rows simply swapped between frames, which is a thing you can miss entirely
 * while looking straight at it.
 */
export function PlayerStrip({
  room,
  playerId,
  reactions,
}: {
  room: RoomState;
  playerId: string | null;
  reactions?: Record<string, { reaction: ReactionId; id: string } | undefined>;
}) {
  const { t } = useLang();
  const answered = new Set(room.answeredPlayerIds);
  const ready = new Set(room.readyPlayerIds);
  const loading = room.phase === "loading";
  const ordered = [...room.players].sort((a, b) => b.score - a.score);
  const { done: doneCount, total } = answeredSummary(
    room.players,
    room.answeredPlayerIds,
    room.readyPlayerIds,
    loading,
  );

  // ------------------------------------------------------------ just answered

  const doneIds = loading ? room.readyPlayerIds : room.answeredPlayerIds;
  // Sorted so the same set in a different order does not read as a change.
  const doneKey = [...doneIds].sort().join(" ");
  const seenRef = useRef(new Set<string>());
  const [justDone, setJustDone] = useState<readonly string[]>([]);

  useEffect(() => {
    const now = new Set(doneIds);
    const fresh = [...now].filter((id) => !seenRef.current.has(id));
    seenRef.current = now;
    if (fresh.length > 0) setJustDone(fresh);
    // Keyed on the membership rather than the array, which is rebuilt on every
    // broadcast whether or not anyone answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);

  // ------------------------------------------------------------- overtaking

  const gridRef = useRef<HTMLDivElement>(null);
  const seatsRef = useRef(new Map<string, DOMRect>());
  const flyingRef = useRef(false);
  const [flying, setFlying] = useState(false);

  // No dependency list on purpose: this measures after every render, which is
  // the only way to catch a reorder the frame it happens.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // getBoundingClientRect reports the animated position, so measuring during
    // a flight would bake that offset in as the cell's resting place. A reorder
    // that lands mid-flight simply goes un-animated.
    if (flyingRef.current) return;

    const seats = new Map<string, DOMRect>();
    const moved: Array<[HTMLElement, number, number]> = [];
    for (const cell of grid.querySelectorAll<HTMLElement>("[data-player]")) {
      const id = cell.dataset.player;
      if (!id) continue;
      const now = cell.getBoundingClientRect();
      seats.set(id, now);
      const before = seatsRef.current.get(id);
      if (!before) continue;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      // Sub-pixel drift from a reflow is not an overtake.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      moved.push([cell, dx, dy]);
    }
    seatsRef.current = seats;
    if (moved.length === 0) return;
    // The Web Animations API does not consult the media query the way CSS
    // does, so this is the only thing standing between a reduced-motion player
    // and a screen full of sliding cells.
    if (prefersReducedMotion()) return;

    flyingRef.current = true;
    setFlying(true);
    let outstanding = moved.length;
    const settle = () => {
      if (--outstanding > 0) return;
      flyingRef.current = false;
      setFlying(false);
    };

    const duration = parseFloat(token(grid, "--duration-flip", "320ms"));
    const easing = token(grid, "--ease-out", "cubic-bezier(0.2, 0, 0, 1)");
    for (const [cell, dx, dy] of moved) {
      cell
        .animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration, easing },
        )
        .addEventListener("finish", settle);
    }
  });

  return (
    <section>
      {/* How many the room is still waiting on, rather than eight cells to
          count. */}
      <FieldLabel>
        {t("players")} · {doneCount}/{total}
      </FieldLabel>
      <div
        ref={gridRef}
        // `.option-row` reads these two, the way the lobby's own grids do.
        style={
          {
            "--cols": columnsFor(ordered.length, 4),
            "--cols-narrow": columnsFor(ordered.length, 2),
          } as CSSProperties
        }
        // The dividing lines are the container's own background, which a cell
        // in flight would otherwise be sliding across. Dropping them to paper
        // for the length of the flight lets the grid dissolve and reform around
        // the move instead of framing it in black.
        className={`option-row mt-2 grid gap-px transition-colors ${
          flying ? "bg-paper" : "bg-ink"
        }`}
      >
        {ordered.map((p) => {
          const done = loading ? ready.has(p.id) : answered.has(p.id);
          return (
            // Filled rather than blinked: a cell that fills reads as another
            // person doing something, and a cell that snaps reads as a glitch.
            <div
              key={p.id}
              data-player={p.id}
              className={`relative flex items-baseline justify-between gap-2 overflow-hidden p-3 transition-colors ${
                done ? "bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
              {/* The colour already said "answered"; this says "just now", and
                  only once. It sits under the name rather than over it, which
                  is what the positioned siblings below are for. */}
              {justDone.includes(p.id) && (
                <span
                  aria-hidden
                  onAnimationEnd={() =>
                    setJustDone((ids) => ids.filter((id) => id !== p.id))
                  }
                  className="sweep pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-accent"
                />
              )}
              <span
                className={`relative flex items-center gap-1.5 truncate ${p.connected ? "" : "line-through opacity-50"}`}
                style={{ fontSize: "var(--text-body)" }}
              >
                <span className="truncate">{p.name}</span>
                {p.id === playerId ? <span className="shrink-0 opacity-75">· {t("you")}</span> : null}
                {reactions?.[p.id] && (
                  <span
                    key={reactions[p.id]?.id}
                    className="animate-fade-in font-mono text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/60 bg-paper/90 px-1 py-0.5 shrink-0"
                  >
                    [{reactions[p.id]?.reaction.toUpperCase()}]
                  </span>
                )}
              </span>
              <span className="numeric label relative shrink-0">{p.score}</span>
            </div>
          );
        })}
        {/* Only ever needed for a part-filled last row — a room of five in a
            grid of four. Below the column count there is no gap to fill, which
            is the whole point of letting the count drive the columns. */}
        {blanks(ordered.length, columnsFor(ordered.length, 4)).map((k) => (
          <div key={k} aria-hidden className="hidden bg-paper sm:block" />
        ))}
        {blanks(ordered.length, columnsFor(ordered.length, 2)).map((k) => (
          <div key={k} aria-hidden className="bg-paper sm:hidden" />
        ))}
      </div>
    </section>
  );
}
