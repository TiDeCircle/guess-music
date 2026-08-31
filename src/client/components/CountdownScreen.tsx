"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/client/i18n";
import { countInSeconds } from "@/client/roundStatus";
import { FieldLabel } from "./Shell";

/**
 * The three seconds before a Match starts.
 *
 * Its own screen rather than a number tucked into the timer, because the point
 * of it is that there is nothing else to look at. The room has spent the last
 * few minutes arguing about playlists; this is the one moment in a Match where
 * everybody has to arrive at the same place at the same time, and a count
 * competing with four options and a player strip does not make anyone look up.
 *
 * It reads the same clock the server does. `startAt` is when the clip begins,
 * corrected for this client's skew, so every screen in the room lands on the
 * same number at the same moment — the count is not a local animation that
 * happens to be about three seconds long.
 */
export function CountdownScreen({
  startAt,
  serverNow,
}: {
  /** Server time the clip starts. */
  startAt: number;
  serverNow: () => number;
}) {
  const { t } = useLang();
  const [count, setCount] = useState(() => countInSeconds(startAt, serverNow()));

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = serverNow();
      setCount(countInSeconds(startAt, now));
      if (now < startAt) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startAt, serverNow]);

  return (
    <div className="flex flex-1 flex-col">
      <FieldLabel>{t("getReady")}</FieldLabel>

      {/* The number is the whole screen. Keyed by its own value so each count
          arrives rather than the digit changing in place — a figure that swaps
          silently reads as a typo, and this one is the only thing moving. */}
      <div className="flex flex-1 items-center justify-center py-16">
        <span
          key={count}
          aria-hidden
          className="numeric enter block font-bold leading-[0.8]"
          style={{ fontSize: "clamp(8rem, 40vw, 20rem)" }}
        >
          {count}
        </span>
      </div>

      {/* One line for a screen reader, which should hear this once and not
          three times. */}
      <p className="sr-only" role="status">
        {t("getReady")}
      </p>
    </div>
  );
}
