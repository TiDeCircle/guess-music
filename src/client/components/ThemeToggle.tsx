"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/client/i18n";
import {
  applyTheme,
  currentTheme,
  hasChosenTheme,
  type Theme,
} from "@/client/theme";

/**
 * Paper or ink.
 *
 * A square with one half filled, which is the whole palette drawn at sixteen
 * pixels and needs no label in either language. It is one button rather than a pair
 * like the language switch: there is no third option worth a cell, and the page
 * itself already shows which side you are on.
 */
export function ThemeToggle() {
  const { t } = useLang();
  /**
   * Null until mounted. The server cannot know what this visitor chose, and
   * rendering a guess would hydrate against the wrong icon.
   */
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());

    // Until they choose, the system decides — and it can change under us, at
    // sunset or on a schedule. The stylesheet follows on its own; this keeps
    // the button's own label honest.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!hasChosenTheme()) setTheme(currentTheme());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={t(next === "dark" ? "themeToDark" : "themeToLight")}
      title={t(next === "dark" ? "themeToDark" : "themeToLight")}
      // No border of its own: it is one cell of the header strip in Shell,
      // which draws the frame and the hairlines between controls.
      className="press flex h-10 w-10 items-center justify-center text-ink hover:bg-grey-100"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
        <rect
          x="0.5"
          y="0.5"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
        />
        <path d="M0.5 0.5 H8 V15.5 H0.5 Z" fill="currentColor" />
      </svg>
    </button>
  );
}
