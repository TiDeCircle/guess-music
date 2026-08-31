"use client";

import { useLang } from "@/client/i18n";

/**
 * The Heardle ladder: how much of the song you have bought, and what the next
 * step costs.
 *
 * Drawn as steps that grow, so the trade is visible without arithmetic — the
 * block you are standing on is how much music you get, and the number above it
 * is what the round is still worth. Spending a level is the only decision this
 * mode asks you to make, so it gets the space.
 */
export function UnlockLadder({
  stagesMs,
  tierPoints,
  level,
  shared,
  canUnlock,
  onUnlock,
  onReplay,
}: {
  stagesMs: number[];
  /** What each level pays, already multiplied. Same length as stagesMs. */
  tierPoints: number[];
  level: number;
  /** True in the co-op mode, where the ladder belongs to the whole room. */
  shared: boolean;
  canUnlock: boolean;
  onUnlock: () => void;
  onReplay: () => void;
}) {
  const { t } = useLang();
  const last = stagesMs.length - 1;
  const atTop = level >= last;
  const nextSeconds = Math.round((stagesMs[Math.min(level + 1, last)] ?? 0) / 1000);
  const nextPoints = tierPoints[Math.min(level + 1, last)] ?? 0;
  const nowPoints = tierPoints[Math.min(level, last)] ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="label text-grey-500">
          {shared ? t("unlockedTeam") : t("unlocked")}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="label text-grey-500">{t("pointsNow")}</span>
          <span
            // Keyed by value so the figure is replaced rather than mutated:
            // this is what the level just cost, and it should land, not blink.
            key={nowPoints}
            className="numeric tick font-semibold"
            style={{ fontSize: "var(--text-title)" }}
          >
            {nowPoints}
          </span>
        </span>
      </div>

      <div className="mt-2 flex h-16 items-end gap-px" aria-hidden>
        {stagesMs.map((ms, i) => (
          <span
            // The block being stood on is re-keyed when the level moves, so the
            // step that was just bought is the only one that animates.
            key={i === level ? `${ms}-${level}` : ms}
            className={`flex-1 transition-colors ${
              i === level ? "step-up bg-accent" : i < level ? "bg-grey-300" : "bg-grey-100"
            }`}
            style={{ height: `${((i + 1) / stagesMs.length) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-px">
        {stagesMs.map((ms, i) => (
          <span
            key={ms}
            className={`numeric label flex-1 text-center ${
              i === level ? "text-ink" : "text-grey-500"
            }`}
          >
            {Math.round(ms / 1000)}
          </span>
        ))}
      </div>

      {/* Replaying what you have already paid for is free. Charging for it
          would charge a lapse in attention rather than one in knowledge. */}
      <button
        type="button"
        disabled={!canUnlock}
        onClick={onReplay}
        className="label mt-4 w-full border border-grey-300 px-4 py-2 transition-colors enabled:hover:border-ink disabled:cursor-not-allowed disabled:text-grey-300"
      >
        {t("replayClip")}
      </button>

      {atTop ? (
        <p className="label mt-3 text-grey-500">{t("unlockedAll")}</p>
      ) : (
        <button
          type="button"
          disabled={!canUnlock}
          onClick={onUnlock}
          className="mt-3 flex w-full items-baseline justify-between gap-4 border border-ink px-4 py-3 text-left transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:border-grey-300 disabled:text-grey-300"
        >
          <span className="label">
            {t("unlockTo")} {nextSeconds} {t("seconds")}
          </span>
          {/* The cost is shown as the points you drop to, not as a subtraction:
              the number you will be paid is the one that matters. */}
          <span className="numeric label">→ {nextPoints}</span>
        </button>
      )}
    </div>
  );
}
