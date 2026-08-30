"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * Two weights only: a solid ink block for the one action a screen is about, and
 * an outlined one for everything else. Red is never a button — it means "this
 * is happening right now" and belongs to the clock.
 */
export function Button({
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" }) {
  const base =
    "label w-full border border-ink px-6 py-4 transition-colors disabled:cursor-not-allowed disabled:border-grey-300 disabled:bg-paper disabled:text-grey-300";
  const skin =
    variant === "solid"
      ? "bg-ink text-paper hover:bg-paper hover:text-ink"
      : "bg-paper text-ink hover:bg-grey-100";
  return <button className={`${base} ${skin} ${className}`} {...props} />;
}
