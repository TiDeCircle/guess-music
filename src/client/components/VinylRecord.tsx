"use client";

import { useId } from "react";
import { useLang } from "@/client/i18n";

/** Where the grooves start and stop, and how tightly they are cut. */
const GROOVE_OUTER = 46;
const GROOVE_INNER = 21;
const GROOVE_PITCH = 0.9;

/** The wider gaps a record shows between one track and the next. */
const BANDS = [45.1, 37.9, 30.7];

const grooves = () => {
  const out: number[] = [];
  for (let r = GROOVE_OUTER; r >= GROOVE_INNER; r -= GROOVE_PITCH) out.push(r);
  return out;
};

/**
 * The record.
 *
 * Drawn rather than photographed: flat ink, hairline grooves, one red centre. A
 * vinyl with a specular highlight and a drop shadow would be the only object in
 * this design pretending to be a thing, and it would look like it had wandered
 * in from another site.
 *
 * Realism here is a matter of pitch, not shading. Seven bold rings read as an
 * archery target; thirty hairlines at a tenth of the contrast read as a cut
 * surface, and the three wider gaps between them are what a record shows
 * between one track and the next. The blank run-out between the last groove and
 * the label is the other half of it.
 *
 * It turns while there is sound and holds still when there is not, which makes
 * it a second and much larger version of the mark beside the clock. `paused`
 * rather than a stopped animation, so it rests at whatever angle it reached
 * instead of snapping back to upright — a record that jumped to twelve o'clock
 * every time the music stopped would read as a reset, not a lift.
 *
 * The printing on the label is not decoration. Everything else here is
 * symmetrical about the spindle, so a disc of bare rings turning at 33rpm is
 * pixel-for-pixel identical at every angle — it span perfectly and looked
 * completely still. The name is the only thing on it that tells you it moved.
 *
 * What the label does not carry is the cover. That is the answer: the server
 * withholds `artworkUrl` from a Round for exactly that reason, and sending it
 * so this component could shrink it would put the full-resolution image one
 * right-click away however small it was drawn. Nothing here accepts one, so
 * nobody adds it back without meeting that argument first.
 */
export function VinylRecord({
  spinning,
  alt = "",
}: {
  /** True while the clip is audible. */
  spinning: boolean;
  alt?: string;
}) {
  const { t } = useLang();
  // Stripped to word characters: React's own ids carry punctuation that
  // `url(#...)` will not parse.
  const arc = `vinyl${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={alt}
      className={`spin block h-full w-full ${spinning ? "" : "[animation-play-state:paused]"}`}
    >
      <defs>
        {/* The circle the label's printing runs around. */}
        <path
          id={arc}
          d="M 50,50 m -11.5,0 a 11.5,11.5 0 1,1 23,0 a 11.5,11.5 0 1,1 -23,0"
          fill="none"
        />
      </defs>

      {/* The disc, and the lip at its edge. */}
      <circle cx="50" cy="50" r="49" fill="var(--color-ink)" />
      <circle
        cx="50"
        cy="50"
        r="47.6"
        fill="none"
        stroke="var(--color-paper)"
        strokeOpacity="0.3"
        strokeWidth="0.4"
      />

      {/* Grooves. Paper at low opacity rather than a grey, so they stay a
          lightening of the disc in both themes instead of a fixed colour that
          is nearly invisible in one of them. */}
      {grooves().map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-paper)"
          strokeOpacity="0.13"
          strokeWidth="0.3"
        />
      ))}

      {/* The gaps between tracks, which catch the light on a real one. */}
      {BANDS.map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-paper)"
          strokeOpacity="0.34"
          strokeWidth="0.45"
        />
      ))}

      {/* The label, and its printing — the only thing on the disc that is not
          symmetrical about the spindle, and therefore the only thing that shows
          it turning. */}
      <circle cx="50" cy="50" r="16" fill="var(--color-paper)" />
      <circle
        cx="50"
        cy="50"
        r="16"
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.25"
        strokeWidth="0.4"
      />
      <text
        fill="var(--color-ink)"
        fillOpacity="0.55"
        fontSize="3.6"
        letterSpacing="0.9"
        fontWeight="500"
      >
        <textPath href={`#${arc}`} startOffset="25%" textAnchor="middle">
          {t("appName")}
        </textPath>
      </text>

      {/* The spindle hole. The one red thing here, and red in this design means
          exactly one thing: this is happening right now. */}
      <circle cx="50" cy="50" r="1.7" fill="var(--color-accent)" />
    </svg>
  );
}
