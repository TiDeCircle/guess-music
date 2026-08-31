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
    "press flex h-10 w-10 items-center justify-center leading-none disabled:cursor-not-allowed disabled:text-grey-300";

  return (
    <div
      className="label flex items-stretch border border-ink"
      role="group"
      aria-label={t("volume")}
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(step - 1)}
        disabled={atMin}
        aria-label={t("volumeDown")}
      >
        −
      </button>

      {/* The level itself. Not a button — pressing a block to jump straight to
          that level is a nice idea that makes the control ambiguous to screen
          readers for no real gain over two taps. */}
      <div
        className="flex items-center gap-px px-1.5"
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
            className={`inline-block h-3 w-1 ${
              i < step ? "bg-ink" : "bg-grey-300"
            }`}
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
        +
      </button>
    </div>
  );
}
