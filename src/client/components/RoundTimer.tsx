"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/client/i18n";

/**
 * The Round clock, drawn as one block per second.
 *
 * Two things the bare number never said. First, where the music stops: the
 * blocks covering the clip stand tall and the Silence that follows sits low, so
 * a player can see at a glance that the quiet stretch is part of the round and
 * not a broken preview. Second, where they are in it — the red block is the
 * second being played right now, which is the one meaning red carries anywhere
 * in this design.
 *
 * The countdown still runs locally against the server's deadline; only its
 * presentation changed.
 */
export function RoundTimer({
  startAt,
  deadlineAt,
  clipMs,
  windowMs,
  serverNow,
  idle,
}: {
  startAt: number;
  deadlineAt: number;
  clipMs: number;
  /** The Round's full Answer Window. Known before the clock starts. */
  windowMs: number;
  serverNow: () => number;
  /** True while waiting for everyone's audio: show the shape, not a count. */
  idle?: boolean;
}) {
  const { t } = useLang();
  const totalBlocks = Math.max(Math.round(windowMs / 1000), 1);
  const clipBlocks = Math.min(Math.round(clipMs / 1000), totalBlocks);

  const [elapsedMs, setElapsedMs] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (idle) {
      setElapsedMs(0);
      return;
    }
    let frame = 0;
    const tick = () => {
      const now = serverNow();
      setElapsedMs(Math.min(Math.max(now - startAt, 0), windowMs));
      if (now < deadlineAt) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [idle, startAt, deadlineAt, windowMs, serverNow]);

  const remainingMs = windowMs - elapsedMs;
  // Ceil so the count reaches zero exactly when answers stop being accepted,
  // rather than showing 0 for a whole second while they still are.
  const seconds = idle ? totalBlocks : Math.ceil(remainingMs / 1000);
  const currentBlock = idle ? -1 : Math.floor(elapsedMs / 1000);
  const playingMusic = !idle && elapsedMs < clipMs;

  return (
    <div>
      <div
        ref={rowRef}
        className="flex h-12 items-end gap-px"
        role="timer"
        aria-label={t("timeLeft")}
      >
        {Array.from({ length: totalBlocks }, (_, i) => {
          const isClip = i < clipBlocks;
          const spent = i < currentBlock;
          const now = i === currentBlock;
          return (
            <span
              key={i}
              className={`flex-1 transition-colors ${isClip ? "h-full" : "h-1/3"} ${
                now
                  ? "bg-accent"
                  : spent
                    ? "bg-grey-300"
                    : isClip
                      ? "bg-ink"
                      : "bg-grey-500"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="label text-grey-500">
          {idle
            ? t("loadingAudio")
            : playingMusic
              ? t("musicPlaying")
              : t("silence")}
        </span>
        <span
          className="numeric font-semibold"
          style={{ fontSize: "var(--text-title)" }}
          aria-live="off"
        >
          {seconds}
        </span>
      </div>
    </div>
  );
}
