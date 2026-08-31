"use client";

/**
 * Whether this visitor has asked for less motion.
 *
 * CSS answers this question through a media query, but the Web Animations API
 * does not: an `element.animate()` call runs at full length no matter what the
 * system setting says. Anything driven from script has to ask here first.
 *
 * Read at call time rather than cached, so changing the setting mid-match takes
 * effect on the next thing that moves.
 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    // Blocked or unimplemented. Prefer the animation over going still.
    return false;
  }
}
