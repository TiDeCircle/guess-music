import type { CSSProperties } from "react";

/**
 * The bar mark from the favicon, redrawn as a component rather than reused as
 * an `<img>`.
 *
 * The favicon itself stays a static file — browser chrome has no theme to
 * match — but the same mark inside the page has to invert with everything
 * else on it, so its fills are the theme tokens rather than the favicon's
 * fixed black-and-white.
 */
export function Logo({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
      className={className}
      style={style}
    >
      <rect width="32" height="32" style={{ fill: "var(--color-ink)" }} />
      <rect x="6" y="14" width="4" height="4" style={{ fill: "var(--color-paper)" }} />
      <rect x="12" y="8" width="4" height="16" style={{ fill: "var(--color-paper)" }} />
      <rect x="18" y="11" width="4" height="10" style={{ fill: "var(--color-accent)" }} />
      <rect x="24" y="6" width="2" height="20" style={{ fill: "var(--color-paper)" }} />
    </svg>
  );
}
