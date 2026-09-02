"use client";

import type { GameModeId } from "@/shared/types";
import { MODE_ORDER } from "@/shared/modes";
import { useLang } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/**
 * The first thing a host chooses, because it is the one that changes what the
 * other two steps mean.
 *
 * Each card carries a drawing of the clip it gives you: Quiz is one solid bar
 * that stops, Heardle is a ladder of steps that grows. That picture is the
 * whole difference between the modes, and it lands faster than the sentence
 * underneath it.
 *
 * Heardle is one card, not two: `heardle` and `heardle-coop` differ by a
 * single flag server-side (`MODES[id].shared` — see src/shared/modes/heardle.ts),
 * and a host picking between "Heardle" and "not Heardle" first, then
 * head-to-head-or-co-op second, matches that better than three parallel
 * cards implying three unrelated games.
 *
 * `disabled` does not hide the grid — a player who cannot change this still
 * wants to see what the host is choosing between, only the tap itself is
 * off.
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

  return (
    <div>
      <FieldLabel>{t("gameMode")}</FieldLabel>
      <div className="mt-2 grid grid-cols-1 gap-px bg-ink sm:grid-cols-2">
        {MODE_ORDER.map((id, i) =>
          id === "heardle" ? (
            <HeardleCard
              key={id}
              index={i}
              value={value}
              disabled={disabled}
              onSelect={onSelect}
            />
          ) : (
            <QuizCard
              key={id}
              index={i}
              active={id === value}
              disabled={disabled}
              onSelect={() => onSelect(id)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function QuizCard({
  index,
  active,
  disabled,
  onSelect,
}: {
  index: number;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t } = useLang();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={`flex min-h-44 flex-col p-4 text-left transition-colors ${
        active
          ? "bg-ink text-paper"
          : disabled
            ? "cursor-not-allowed bg-paper text-grey-500"
            : "bg-paper text-ink hover:bg-grey-100"
      }`}
    >
      <span className="numeric label">{String(index + 1).padStart(2, "0")}</span>
      <span className="mt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
        {t("mode.quiz")}
      </span>

      <ClipShape stages={0} />

      <span className={`label mt-3 leading-relaxed ${active ? "text-grey-300" : "text-grey-500"}`}>
        {t("mode.quiz.hint")}
      </span>
    </button>
  );
}

/**
 * Heardle, plus the choice its old second and third cards used to make on
 * their own: play against each other, or share one ladder. The card itself
 * is not a button — there is nothing to select until one of the two pills
 * below is tapped, and each of those still calls `onSelect` with the real
 * `GameModeId` the rest of the app already knows.
 */
function HeardleCard({
  index,
  value,
  disabled,
  onSelect,
}: {
  index: number;
  value: GameModeId;
  disabled: boolean;
  onSelect: (mode: GameModeId) => void;
}) {
  const { t } = useLang();
  const active = value === "heardle" || value === "heardle-coop";

  return (
    <div
      className={`flex min-h-44 flex-col p-4 text-left transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper text-ink"
      }`}
    >
      <span className="numeric label">{String(index + 1).padStart(2, "0")}</span>
      <span className="mt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
        {t("mode.heardle-group")}
      </span>

      <ClipShape stages={4} />

      <span className={`label mt-3 leading-relaxed ${active ? "text-grey-300" : "text-grey-500"}`}>
        {t("mode.heardle-group.hint")}
      </span>

      <div className="mt-3 grid grid-cols-2 gap-px bg-current">
        <HeardleToggle
          label={t("heardleModeCompete")}
          selected={value === "heardle"}
          cardActive={active}
          disabled={disabled}
          onClick={() => onSelect("heardle")}
        />
        <HeardleToggle
          label={t("heardleModeCoop")}
          selected={value === "heardle-coop"}
          cardActive={active}
          disabled={disabled}
          onClick={() => onSelect("heardle-coop")}
        />
      </div>
    </div>
  );
}

/**
 * One of the two pills inside the Heardle card. Filled the opposite way from
 * the card around it — the same trick a selected cell uses one level up —
 * so "this one" reads the same whether the card itself is light or dark.
 */
function HeardleToggle({
  label,
  selected,
  cardActive,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  cardActive: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const filled = cardActive ? "bg-paper text-ink" : "bg-ink text-paper";
  const blended = cardActive ? "bg-ink text-paper" : "bg-paper text-ink";

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`label px-2 py-2 text-center transition-colors ${
        selected
          ? filled
          : disabled
            ? `cursor-not-allowed ${blended} opacity-60`
            : `${blended} hover:opacity-70`
      }`}
    >
      {label}
    </button>
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
