"use client";

import type { ReactNode } from "react";
import { LANGS, useLang } from "@/client/i18n";
import type { ConnectionStatus } from "@/client/useGame";
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
          <span className="label font-bold">{t("appName")}</span>

          <div className="flex items-center gap-4 md:gap-6">
            <VolumeControl step={volumeStep} onChange={onVolumeChange} />

            <span className="label flex items-center gap-2 text-grey-500">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 ${
                  status === "online" ? "bg-ink" : "bg-accent"
                }`}
              />
              {/* Only named when something is wrong; a healthy connection is
                  just the mark, with no label taking up the grid. */}
              {status !== "online" &&
                t(status === "connecting" ? "connecting" : "offline")}
              <span className="sr-only">{status}</span>
            </span>

            <div className="label flex items-center gap-0 border border-ink">
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`px-2 py-1 transition-colors ${
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
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-12">
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
