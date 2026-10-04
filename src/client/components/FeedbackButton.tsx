"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/client/i18n";
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackKind,
} from "@/shared/feedback";
import { Button } from "./Button";

type Status = "idle" | "sending" | "sent" | "rate-limited" | "failed";

/**
 * A way to reach the person who made the game, and the form it opens.
 *
 * Trigger and dialog live together so any screen can drop one in without
 * threading open state through Game. `context` is where the player was —
 * the mode and Song Source of a finished match, say — so a bug report arrives
 * already knowing what to reproduce.
 */
export function FeedbackButton({
  variant,
  context = "",
}: {
  /** `header` is the red one in the top bar, on every screen; `button` sits among a screen's actions. */
  variant: "header" | "button";
  context?: string;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const close = () => {
    setOpen(false);
    // A sent form starts clean next time; an unsent one keeps its draft.
    if (status === "sent") {
      setMessage("");
      setContact("");
      setKind("idea");
    }
    setStatus("idle");
  };

  useEffect(() => {
    if (!open) return;
    messageRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `close` reads the latest status; rebinding on it would refocus the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message, contact, context, lang }),
      });
      setStatus(res.ok ? "sent" : res.status === 429 ? "rate-limited" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <>
      {variant === "header" ? (
        // Red, against the rule that red belongs to the clock: the owner wants
        // this found, and the header is the one place a clock never is.
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label press flex h-10 shrink-0 items-center whitespace-nowrap border border-accent bg-accent px-3 text-white hover:bg-paper hover:text-accent"
        >
          {t("feedbackShort")}
        </button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t("feedback")}
        </Button>
      )}

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("feedbackTitle")}
            onClick={(e) => e.stopPropagation()}
            className="enter max-h-full w-full max-w-md overflow-y-auto border border-ink bg-paper p-6"
          >
            <p className="font-semibold" style={{ fontSize: "var(--text-title)" }}>
              {t("feedbackTitle")}
            </p>

            {status === "sent" ? (
              <>
                <p className="mt-4 text-pretty" role="status" style={{ fontSize: "var(--text-body)" }}>
                  {t("feedbackThanks")}
                </p>
                <div className="mt-6">
                  <Button onClick={close}>{t("close")}</Button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <p className="mt-2 text-pretty text-grey-500">{t("feedbackHint")}</p>

                {/* The same hairline strip the header's controls sit in. */}
                <div
                  role="radiogroup"
                  className="label mt-6 grid grid-cols-4 divide-x divide-ink border border-ink"
                >
                  {FEEDBACK_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={kind === k}
                      onClick={() => setKind(k)}
                      className={`press h-10 ${
                        kind === k ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-grey-100"
                      }`}
                    >
                      {t(`feedbackKind.${k}`)}
                    </button>
                  ))}
                </div>

                <label className="mt-6 block">
                  <span className="label text-grey-500">{t("feedbackMessage")}</span>
                  <textarea
                    ref={messageRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={FEEDBACK_MESSAGE_MAX}
                    rows={5}
                    required
                    placeholder={t("feedbackPlaceholder")}
                    className="mt-2 block w-full resize-y border border-ink bg-transparent p-3 outline-none placeholder:text-grey-300 focus:border-accent"
                  />
                  <span className="numeric label mt-1 block text-right text-grey-300">
                    {message.length}/{FEEDBACK_MESSAGE_MAX}
                  </span>
                </label>

                <label className="mt-2 block">
                  <span className="label text-grey-500">{t("feedbackContact")}</span>
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={FEEDBACK_CONTACT_MAX}
                    placeholder={t("feedbackContactPlaceholder")}
                    className="mt-2 w-full border-b border-ink bg-transparent pb-2 outline-none placeholder:text-grey-300 focus:border-b-2 focus:border-accent focus:pb-[7px]"
                  />
                </label>

                {(status === "failed" || status === "rate-limited") && (
                  <p role="alert" className="label mt-4 text-accent">
                    {t(status === "failed" ? "feedbackFailed" : "feedbackRateLimited")}
                  </p>
                )}

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Button type="button" variant="outline" onClick={close}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={!message.trim() || status === "sending"}>
                    {status === "sending" ? t("feedbackSending") : t("feedbackSend")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
