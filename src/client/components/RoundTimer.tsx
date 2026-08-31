"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/client/i18n";
import { isFinalStretch } from "@/client/roundStatus";

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
  audibleMs,
  serverNow,
  idle,
  countIn,
}: {
  startAt: number;
  deadlineAt: number;
  clipMs: number;
  /** The Round's full Answer Window. Known before the clock starts. */
  windowMs: number;
  /**
   * How much of the clip is actually audible right now. Differs from `clipMs`
   * in Heardle, where it is whatever this player has unlocked so far.
   */
  audibleMs?: number;
  serverNow: () => number;
  /** True while waiting for everyone's audio: show the shape, not a count. */
  idle?: boolean;
  /**
   * True on the Round that opens a Match, whose lead-in is long enough to be
   * counted out loud. Every other Round's is a beat, and a number that flashed
   * "2, 1" on the way past would be noise rather than a count.
   */
  countIn?: boolean;
}) {
  const { t } = useLang();
  // Signed, because the Round goes live a beat before the clip starts and
  // everything about that beat is the fact that it is still negative.
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    if (idle) {
      setOffsetMs(0);
      return;
    }
    let frame = 0;
    const tick = () => {
      const now = serverNow();
      setOffsetMs(Math.min(now - startAt, windowMs));
      if (now < deadlineAt) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [idle, startAt, deadlineAt, windowMs, serverNow]);

  // Heardle hands over an audible length; Quiz has none, and gets the
  // block-per-second bar it was designed around.
  // Everything downstream counts from the clip, so the lead-in reads as a
  // round that has not started spending its window yet.
  const leadIn = !idle && offsetMs < 0;
  const elapsedMs = Math.max(offsetMs, 0);

  const continuous = audibleMs !== undefined;
  const audible = audibleMs ?? clipMs;
  const playingMusic = !idle && !leadIn && elapsedMs < audible;
  const remainingMs = windowMs - elapsedMs;
  const urgent = isFinalStretch(remainingMs, Boolean(idle));

  return (
    <div>
      {continuous ? (
        <WindowBar
          windowMs={windowMs}
          audibleMs={audible}
          elapsedMs={elapsedMs}
          idle={idle}
          label={t("timeLeft")}
        />
      ) : (
        <SecondBar
          windowMs={windowMs}
          clipMs={audible}
          elapsedMs={elapsedMs}
          idle={idle}
          label={t("timeLeft")}
        />
      )}

      <div className="mt-3 flex items-baseline justify-between">
        <span className="label flex items-center gap-2 text-grey-500">
          {/* Beating means there is sound coming out; a flat grey square means
              there is not. Saying it in words alone left the quiet stretch and
              the playing stretch looking identical from across a table. */}
          <span
            aria-hidden
            className={`inline-block h-2 w-2 shrink-0 transition-colors ${
              playingMusic
                ? "beat bg-accent"
                : leadIn
                  ? "bg-accent"
                  : "bg-grey-300"
            }`}
          />
          {idle
            ? t("loadingAudio")
            : leadIn
              ? t("getReady")
              : playingMusic
                ? t("musicPlaying")
                : t("silence")}
        </span>
        {/* The last few seconds are the most "now" thing on the screen, and red
            is what this design reserves for exactly that. The number changes
            colour rather than size, because a countdown that grows shifts the
            whole row it sits in. */}
        <span
          className={`numeric font-semibold transition-colors ${
            urgent ? "text-accent" : ""
          }`}
          style={{ fontSize: "var(--text-title)" }}
          aria-live="off"
        >
          {/* Ceil so the count reaches zero exactly when answers stop being
              accepted, rather than showing 0 for a whole second while they
              still are. The count-in borrows the same slot and the same ceil,
              counting the negative offset down to the moment the music starts —
              it stays ink rather than going red, because red is what the last
              seconds of the answer window are going to need. */}
          {idle
            ? Math.max(Math.round(windowMs / 1000), 1)
            : countIn && leadIn
              ? Math.ceil(-offsetMs / 1000)
              : Math.ceil((windowMs - elapsedMs) / 1000)}
        </span>
      </div>
    </div>
  );
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
 * Heardle: one continuous bar rather than forty little blocks.
 *
 * The window here is long enough to type a Thai title in, and a block per
 * second at that length reads as noise. The filled stretch is how much music
 * this player has unlocked; the rest is the time left to use it.
 */
function WindowBar({
  windowMs,
  audibleMs,
  elapsedMs,
  idle,
  label,
}: {
  windowMs: number;
  audibleMs: number;
  elapsedMs: number;
  idle?: boolean;
  label: string;
}) {
  // A fraction, not a percentage: this one is spent as a transform, because it
  // is the only value here that changes every frame.
  const played = idle ? 0 : Math.min(elapsedMs / windowMs, 1);
  const music = Math.min(audibleMs / windowMs, 1) * 100;

  return (
    <div className="relative h-3 w-full bg-grey-100" role="timer" aria-label={label}>
      {/* Where the music reaches, so the quiet stretch reads as part of the
          round rather than a preview that died. */}
      <span className="absolute inset-y-0 left-0 bg-grey-300" style={{ width: `${music}%` }} />
      {/* The clock hand. Full width and squashed from the left rather than
          grown by width: this is redrawn on every animation frame for the whole
          round, and width would cost a layout pass each time where a transform
          costs none. Its two neighbours move only when a level is bought, so
          they stay on the simpler property. */}
      <span
        className="absolute inset-y-0 left-0 w-full origin-left bg-ink"
        style={{ transform: `scaleX(${played})`, willChange: "transform" }}
      />
      <span
        className="absolute inset-y-0 w-px bg-accent"
        style={{ left: `${music}%` }}
        aria-hidden
      />
    </div>
  );
}
