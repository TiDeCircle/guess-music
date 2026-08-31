"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/client/i18n";

/**
 * The Round clock.
 *
 * Two things a bare number never said. First, where the music stops: the blocks
 * covering the clip stand tall and the Silence that follows sits low, so a
 * player can see at a glance that the quiet stretch is part of the round and not
 * a broken preview. Second, where they are in it — the red block is the moment
 * being played right now, which is the one meaning red carries anywhere in this
 * design.
 *
 * In Heardle the blocks stop being seconds and become the score tiers, because
 * that is what a player is actually deciding against: not "how long is left"
 * but "how much is it still worth". The countdown still runs locally against the
 * server's deadline either way; only its presentation changed.
 */
export function RoundTimer({
  startAt,
  deadlineAt,
  clipMs,
  windowMs,
  stagesMs,
  tierPoints,
  serverNow,
  idle,
}: {
  startAt: number;
  deadlineAt: number;
  clipMs: number;
  /** The Round's full Answer Window. Known before the clock starts. */
  windowMs: number;
  /** Heardle: where the score tier drops. Empty in Quiz. */
  stagesMs?: number[];
  /** What each tier pays, already multiplied. Same length as stagesMs. */
  tierPoints?: number[];
  serverNow: () => number;
  /** True while waiting for everyone's audio: show the shape, not a count. */
  idle?: boolean;
}) {
  const { t } = useLang();
  const [elapsedMs, setElapsedMs] = useState(0);

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

  const staged = (stagesMs?.length ?? 0) > 0;
  const playingMusic = !idle && elapsedMs < clipMs;

  return (
    <div>
      {staged ? (
        <StageBar
          stagesMs={stagesMs!}
          windowMs={windowMs}
          elapsedMs={elapsedMs}
          idle={idle}
          label={t("timeLeft")}
        />
      ) : (
        <SecondBar
          windowMs={windowMs}
          clipMs={clipMs}
          elapsedMs={elapsedMs}
          idle={idle}
          label={t("timeLeft")}
        />
      )}

      <div className="mt-3 flex items-baseline justify-between">
        <span className="label text-grey-500">
          {idle
            ? t("loadingAudio")
            : playingMusic
              ? t("musicPlaying")
              : t("silence")}
        </span>
        {staged && tierPoints ? (
          <span className="flex items-baseline gap-2">
            <span className="label text-grey-500">{t("pointsNow")}</span>
            <span
              className="numeric font-semibold"
              style={{ fontSize: "var(--text-title)" }}
              aria-live="off"
            >
              {tierPoints[stageIndex(stagesMs!, idle ? 0 : elapsedMs)]}
            </span>
          </span>
        ) : (
          <span
            className="numeric font-semibold"
            style={{ fontSize: "var(--text-title)" }}
            aria-live="off"
          >
            {/* Ceil so the count reaches zero exactly when answers stop being
                accepted, rather than showing 0 for a whole second while they
                still are. */}
            {idle
              ? Math.max(Math.round(windowMs / 1000), 1)
              : Math.ceil((windowMs - elapsedMs) / 1000)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Which tier the clip has reached. Mirrors `stageAt` on the server. */
function stageIndex(stagesMs: readonly number[], elapsedMs: number): number {
  const i = stagesMs.findIndex((end) => elapsedMs < end);
  return i === -1 ? Math.max(stagesMs.length - 1, 0) : i;
}

/** Quiz: one block per second, tall while the music plays. */
function SecondBar({
  windowMs,
  clipMs,
  elapsedMs,
  idle,
  label,
}: {
  windowMs: number;
  clipMs: number;
  elapsedMs: number;
  idle?: boolean;
  label: string;
}) {
  const totalBlocks = Math.max(Math.round(windowMs / 1000), 1);
  const clipBlocks = Math.min(Math.round(clipMs / 1000), totalBlocks);
  const currentBlock = idle ? -1 : Math.floor(elapsedMs / 1000);

  return (
    <div className="flex h-12 items-end gap-px" role="timer" aria-label={label}>
      {Array.from({ length: totalBlocks }, (_, i) => {
        const isClip = i < clipBlocks;
        return (
          <span
            key={i}
            className={`flex-1 transition-colors ${isClip ? "h-full" : "h-1/3"} ${
              i === currentBlock
                ? "bg-accent"
                : i < currentBlock
                  ? "bg-grey-300"
                  : isClip
                    ? "bg-ink"
                    : "bg-grey-500"
            }`}
          />
        );
      })}
    </div>
  );
}

/**
 * Heardle: one block per score tier, each as wide as the stretch of music it
 * covers.
 *
 * The widths are the point. The top tier is a sliver and the bottom one is half
 * the bar, which is exactly how the round feels — the expensive decision is the
 * one you make in the first second.
 */
function StageBar({
  stagesMs,
  windowMs,
  elapsedMs,
  idle,
  label,
}: {
  stagesMs: number[];
  windowMs: number;
  elapsedMs: number;
  idle?: boolean;
  label: string;
}) {
  const clipMs = stagesMs[stagesMs.length - 1] ?? windowMs;
  const current = idle ? -1 : stageIndex(stagesMs, elapsedMs);
  // The Silence after the last stage still accepts answers, so it belongs on
  // the bar — low, like every other stretch with no music in it.
  const silenceMs = Math.max(windowMs - clipMs, 0);
  const inSilence = !idle && elapsedMs >= clipMs;

  return (
    <div className="flex h-12 items-end gap-px" role="timer" aria-label={label}>
      {stagesMs.map((end, i) => {
        const start = i === 0 ? 0 : (stagesMs[i - 1] ?? 0);
        return (
          <span
            key={end}
            className={`h-full transition-colors ${
              !inSilence && i === current
                ? "bg-accent"
                : i < current || inSilence
                  ? "bg-grey-300"
                  : "bg-ink"
            }`}
            style={{ flexGrow: Math.max(end - start, 1) }}
          />
        );
      })}
      {silenceMs > 0 && (
        <span
          className={`h-1/3 transition-colors ${inSilence ? "bg-accent" : "bg-grey-500"}`}
          style={{ flexGrow: silenceMs }}
        />
      )}
    </div>
  );
}
