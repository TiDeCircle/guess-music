"use client";

import { useCallback, useState } from "react";
import { REACTION_IDS, type ReactionId } from "@/shared/protocol";
import { useLang } from "@/client/i18n";

const STAMP_LABELS: Record<ReactionId, string> = {
  alert: "[!]",
  what: "[?]",
  gg: "[GG]",
  fast: "[FAST]",
  oops: "[OOPS]",
  fire: "[FIRE]",
};

export function ReactionPicker({
  onReact,
}: {
  onReact: (reaction: ReactionId) => void;
}) {
  const { t } = useLang();
  const [cooldown, setCooldown] = useState(false);

  const handleSelect = useCallback(
    (reaction: ReactionId) => {
      if (cooldown) return;
      onReact(reaction);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 500);
    },
    [cooldown, onReact],
  );

  return (
    <div
      role="group"
      aria-label={t("react")}
      className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted mr-1 select-none">
        {t("react")}:
      </span>
      {REACTION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          disabled={cooldown}
          onClick={() => handleSelect(id)}
          title={t(`reaction.${id}` as any)}
          aria-label={t(`reaction.${id}` as any)}
          className={`font-mono text-xs font-bold tracking-tight px-2 py-1 transition-all border border-ink/20 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
            cooldown ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {STAMP_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
