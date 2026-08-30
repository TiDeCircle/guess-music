"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts down to a server deadline.
 *
 * The server sends the deadline once and never ticks; this runs locally on
 * requestAnimationFrame so the bar moves smoothly instead of stepping once a
 * second, and it costs no traffic. `serverNow` folds in the clock offset
 * measured at join, so two phones with clocks minutes apart still agree.
 */
export function Countdown({
  startAt,
  deadlineAt,
  serverNow,
}: {
  startAt: number;
  deadlineAt: number;
  serverNow: () => number;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(deadlineAt - serverNow(), 0),
  );
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const total = Math.max(deadlineAt - startAt, 1);

    const tick = () => {
      const left = Math.max(deadlineAt - serverNow(), 0);
      setRemainingMs(left);
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${left / total})`;
      }
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startAt, deadlineAt, serverNow]);

  // Ceil so the display reaches zero exactly when time is actually up, rather
  // than showing "0" for a whole second while answers are still accepted.
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div>
      <div
        className="numeric leading-[0.8] font-semibold"
        // Full display size on desktop, scaled down on a phone so the answer
        // grid still fits above the fold.
        style={{ fontSize: "clamp(3.5rem, 14vw, var(--text-display))" }}
        aria-live="off"
      >
        {seconds}
      </div>
      <div className="mt-4 h-1 w-full bg-grey-300" role="presentation">
        <div
          ref={barRef}
          className="h-full origin-left bg-accent"
          style={{ transform: "scaleX(1)" }}
        />
      </div>
    </div>
  );
}
