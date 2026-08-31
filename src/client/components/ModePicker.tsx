"use client";

import type { GameModeId } from "@/shared/types";
import { MODE_ORDER, MODES } from "@/shared/modes";
import { useLang, type StringKey } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/**
 * The first thing a host chooses, because it is the one that changes what the
 * other two steps mean.
 *
 * Each card carries a drawing of the clip it gives you: Quiz is one solid bar
 * that stops, Heardle is a ladder of steps that grows. That picture is the
 * whole difference between the modes, and it lands faster than the sentence
 * underneath it.
 */
export function ModePicker({
  value,
  disabled,
  onSelect,
}: {
  value: GameModeId;
  disabled: boolean;
  onSelect: (mode: GameModeId) => void;
}) {
  const { t } = useLang();

  if (disabled) {
    return (
      <div>
        <FieldLabel>{t("gameMode")}</FieldLabel>
        <p className="mt-2 py-4" style={{ fontSize: "var(--text-body)" }}>
          {t(`mode.${value}` as StringKey)}
        </p>
      </div>
    );
  }

  return (
    <div>
      <FieldLabel>{t("gameMode")}</FieldLabel>
      <div className="mt-2 grid grid-cols-1 gap-px bg-ink sm:grid-cols-3">
        {MODE_ORDER.map((id, i) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(id)}
              className={`flex min-h-44 flex-col p-4 text-left transition-colors ${
                active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
              }`}
            >
              <span className="numeric label">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
                {t(`mode.${id}` as StringKey)}
              </span>

              <ClipShape stages={id === "quiz" ? 0 : 4} />

              <span
                className={`label mt-3 leading-relaxed ${
                  active ? "text-grey-300" : "text-grey-500"
                }`}
              >
                {t(`mode.${id}.hint` as StringKey)}
              </span>
              {MODES[id].shared && (
                <span className={`label mt-3 ${active ? "" : "text-ink"}`}>
                  ● {t("coopWaiting")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What the clip does over the round: one fixed block for Quiz, a staircase you
 * climb for Heardle. Both draw in currentColor so the shape inverts with the
 * card.
 */
function ClipShape({ stages }: { stages: number }) {
  if (stages === 0) {
    return (
      <span className="mt-4 flex h-6 items-end gap-px" aria-hidden>
        <span className="h-full flex-[3] bg-current" />
        <span className="h-1/3 flex-1 bg-current opacity-30" />
      </span>
    );
  }
  return (
    <span className="mt-4 flex h-6 items-end gap-px" aria-hidden>
      {Array.from({ length: stages }, (_, i) => (
        <span
          key={i}
          className="flex-1 bg-current"
          style={{ height: `${((i + 1) / stages) * 100}%` }}
        />
      ))}
    </span>
  );
}
