"use client";

import { useLang } from "@/client/i18n";
import { VOLUME_STEPS } from "@/client/useGame";

/**
 * Volume as a stepped bar between a minus and a plus.
 *
 * A native range slider would be the obvious control and the wrong one here:
 * it brings its own rounded, shaded appearance that no amount of CSS makes
 * belong in this design. Discrete blocks match the grid — and read as a level
 * at a glance rather than needing a number.
 *
 * Renders without a border of its own: it is one cell of the header strip in
 * Shell, which draws the frame and the hairlines between controls.
 */
export function VolumeControl({
  step,
  onChange,
}: {
  step: number;
  onChange: (step: number) => void;
}) {
  const { t } = useLang();
  const atMin = step <= 0;
  const atMax = step >= VOLUME_STEPS;

  // Forty across and forty down. A minus sign is a small thing to aim at, and
  // this one gets aimed at mid-round, one-handed, on a phone.
  const button =
    "press flex h-10 w-10 items-center justify-center leading-none enabled:hover:bg-grey-100 disabled:cursor-not-allowed disabled:text-grey-300";

  return (
    <div className="flex items-stretch" role="group" aria-label={t("volume")}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(step - 1)}
        disabled={atMin}
        aria-label={t("volumeDown")}
      >
        <Minus />
      </button>

      {/* The level itself. Not a button — pressing a block to jump straight to
          that level is a nice idea that makes the control ambiguous to screen
          readers for no real gain over two taps. */}
      <div
        className="flex items-center gap-px px-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={VOLUME_STEPS}
        aria-valuenow={step}
        aria-label={t("volume")}
      >
        {Array.from({ length: VOLUME_STEPS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            // Half the height of the cell it sits in. At twelve pixels these
            // read as specks, and the unspent steps disappeared entirely.
            className={`inline-block h-5 w-1 ${i < step ? "bg-ink" : "bg-grey-300"}`}
          />
        ))}
      </div>

      <button
        type="button"
        className={button}
        onClick={() => onChange(step + 1)}
        disabled={atMax}
        aria-label={t("volumeUp")}
      >
        <Plus />
      </button>
    </div>
  );
}

/**
 * Drawn rather than typed.
 *
 * A text minus and a text plus are different weights, sit on different optical
 * centres, and are whatever size the font decides — next to the theme toggle's
 * sixteen-pixel square they read as two different design systems. Two pixels
 * thick, sixteen across, same as the icon beside them.
 */
function Minus() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <rect x="2" y="7" width="12" height="2" fill="currentColor" />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <rect x="2" y="7" width="12" height="2" fill="currentColor" />
      <rect x="7" y="2" width="2" height="12" fill="currentColor" />
    </svg>
  );
}
