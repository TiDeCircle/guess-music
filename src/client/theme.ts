"use client";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "guess-music.theme";

/**
 * Runs before anything is painted, from a blocking script in the document head.
 *
 * Without it the page paints light, hydrates, and then snaps dark — a white
 * flash straight into the eyes of the one person who chose dark mode, which is
 * exactly who is least able to take it. Kept to one line of plain ES5 because it
 * is inlined into the HTML and must never be the thing that breaks the page.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

/**
 * What the page is actually showing right now.
 *
 * An explicit choice is stamped on the root element; with nothing stamped the
 * system setting decides, exactly as the stylesheet does.
 */
export function currentTheme(): Theme {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "light" || stamped === "dark") return stamped;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Whether the visitor has chosen, as opposed to inheriting the system's. */
export function hasChosenTheme(): boolean {
  return document.documentElement.hasAttribute("data-theme");
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode and blocked site data both land here. The choice still
    // applies to this tab; it just will not survive a reload.
  }
}
