"use client";

import { useLang } from "@/client/i18n";
import type { RoundOutcome } from "@/client/useGame";

/**
 * How the Match has gone so far, one cell per Round.
 *
 * Filled means you got it, struck through means you did not, empty means you
 * ran out of time. The same weight-and-strikethrough language the reveal uses,
 * so nothing here needs colour to be read.
 */
export function RoundDots({
  total,
  current,
  history,
}: {
  total: number;
  current: number;
  history: RoundOutcome[];
}) {
  const { t } = useLang();

  return (
    <div>
      <div className="label mb-2 text-grey-500">{t("yourRounds")}</div>
      <div className="flex gap-px">
        {Array.from({ length: total }, (_, i) => {
          const outcome = history[i];
          const isCurrent = i === current;
          return (
            <span
              key={i}
              title={`${t("round")} ${i + 1}`}
              className={`relative h-6 flex-1 ${
                isCurrent
                  ? "bg-accent"
                  : outcome === "correct"
                    ? "bg-ink"
                    : outcome === undefined
                      ? "bg-grey-100"
                      : "bg-grey-300"
              }`}
            >
              {outcome === "wrong" && (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-ink"
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
