"use client";

import { useEffect } from "react";
import { Button } from "./Button";

/**
 * The one modal in the app, so it earns being generic rather than local to
 * whoever needed it first: kicking a player and leaving mid-round both throw
 * something away, and a native `confirm()` speaks the browser's voice, not
 * this one's.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** Optional — the kick dialog uses the player's name here, plain. */
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title ?? message}
        onClick={(e) => e.stopPropagation()}
        className="enter w-full max-w-sm border border-ink bg-paper p-6"
      >
        {/* A player's actual name, so it stays in the case they typed it —
            everywhere else names are shown, from the player strip to the
            lobby list, none of them get the small-caps label treatment. */}
        {title && (
          <p className="font-semibold" style={{ fontSize: "var(--text-title)" }}>
            {title}
          </p>
        )}
        <p
          className={`text-pretty ${title ? "mt-2 text-grey-500" : ""}`}
          style={{ fontSize: "var(--text-body)" }}
        >
          {message}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
