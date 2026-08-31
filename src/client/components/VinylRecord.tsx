"use client";

import { useId } from "react";

/**
 * The record.
 *
 * Drawn rather than rendered: flat ink, hairline grooves, one red centre. A
 * photographic vinyl with a highlight and a drop shadow would be the only
 * object in this design pretending to be a thing, and it would look like it had
 * wandered in from another site. Concentric hairlines are the same language the
 * timer's blocks are in — repetition at a small scale, which is the one thing
 * on this screen that reads as dense.
 *
 * It turns while there is sound and holds still when there is not, which makes
 * it a second and much larger version of the mark beside the clock. `paused`
 * rather than a stopped animation, so it rests at whatever angle it reached
 * instead of snapping back to upright — a record that jumped to twelve o'clock
 * every time the music stopped would read as a reset, not a lift.
 *
 * The label is blank for the whole round, and not for want of something to put
 * there: the artwork is the answer, so the server does not send it until the
 * reveal. That is where `artworkUrl` comes from, and the cover landing on the
 * label is the moment this component exists for.
 */
export function VinylRecord({
  spinning,
  artworkUrl,
  alt = "",
}: {
  /** True while the clip is audible. */
  spinning: boolean;
  /** Only ever set on the reveal — during a Round this is the answer. */
  artworkUrl?: string;
  alt?: string;
}) {
  // Two records can share a page — the reveal replaces the round's, and for a
  // frame both exist — and a duplicated clipPath id would silently point both
  // labels at the first one. Stripped to word characters because React's own
  // ids carry punctuation that `url(#...)` will not parse.
  const labelClip = `vinyl${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={alt}
      className={`spin block h-full w-full ${spinning ? "" : "[animation-play-state:paused]"}`}
    >
      <defs>
        <clipPath id={labelClip}>
          <circle cx="50" cy="50" r="17" />
        </clipPath>
      </defs>

      {/* The disc. */}
      <circle cx="50" cy="50" r="49" fill="var(--color-ink)" />

      {/* Grooves. Paper at low opacity rather than a grey, so they stay a
          lightening of the disc in both themes instead of a fixed colour that
          is nearly invisible in one of them. */}
      {[45, 41, 37, 33, 29, 25, 21].map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-paper)"
          strokeOpacity="0.22"
          strokeWidth="0.6"
        />
      ))}

      {/* The label. Empty through the round; the cover lands here on reveal. */}
      <circle cx="50" cy="50" r="17" fill="var(--color-paper)" />
      {artworkUrl && (
        <image
          href={artworkUrl}
          x="33"
          y="33"
          width="34"
          height="34"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${labelClip})`}
        />
      )}
      {/* The rim of the label, which the artwork would otherwise run under. */}
      <circle
        cx="50"
        cy="50"
        r="17"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="0.6"
      />

      {/* The spindle hole. The one red thing here, and red in this design means
          exactly one thing: this is happening right now. */}
      <circle cx="50" cy="50" r="2.4" fill="var(--color-accent)" />
    </svg>
  );
}
