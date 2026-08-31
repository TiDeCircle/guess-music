"use client";

import type { ReactNode } from "react";
import { LANGS, useLang } from "@/client/i18n";
import type { ConnectionStatus } from "@/client/useGame";
import { ThemeToggle } from "./ThemeToggle";
import { VolumeControl } from "./VolumeControl";

/**
 * The frame every screen sits in: a hairline header, a 12-column field, and
 * nothing else. Swiss layout gets its structure from the rules and the grid,
 * not from boxes and shadows.
 */
export function Shell({
  status,
  volumeStep,
  onVolumeChange,
  children,
}: {
  status: ConnectionStatus;
  volumeStep: number;
  onVolumeChange: (step: number) => void;
  children: ReactNode;
}) {
  const { lang, setLang, t } = useLang();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-8">
          <span className="label truncate font-bold">{t("appName")}</span>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Nothing at all while the connection is healthy. The mark that
                used to sit here said "fine" by being a small black square with
                no label and no frame, which next to three bordered controls
                read as debris rather than as an indicator. Absence is the
                better signal; only trouble gets a cell — and being the only
                live region on the page, it announces itself when it appears
                instead of competing with a hidden one reading the raw enum. */}
            {status !== "online" && (
              <span
                role="status"
                className="label flex h-10 items-center gap-2 border border-accent px-3 text-accent"
              >
                <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
                {t(status === "connecting" ? "connecting" : "offline")}
              </span>
            )}
            {/* One strip, hairlines between the controls — the same thing the
                option rows, the player strip and the answer grid all do. Three
                separate boxes was the one place in the design that fragmented,
                and it was also why the theme toggle ended up two pixels shorter
                than its neighbours: its border was its own, theirs was their
                container's. One frame, and they cannot disagree. */}
            <div className="flex items-stretch divide-x divide-ink border border-ink">
              <VolumeControl step={volumeStep} onChange={onVolumeChange} />

              <ThemeToggle />

              <div className="label flex items-stretch divide-x divide-ink">
                {LANGS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className={`press flex h-10 w-10 items-center justify-center ${
                      lang === code
                        ? "bg-ink text-paper"
                        : "bg-paper text-ink hover:bg-grey-100"
                    }`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* A column, so a screen that asks to fill the field can. */}
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
        {children}
      </main>
    </div>
  );
}

/** A small uppercase caption over a hairline — the Swiss section marker. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="label border-t border-ink pt-2 text-grey-500">{children}</div>
  );
}
