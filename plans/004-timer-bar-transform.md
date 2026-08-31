# 004 — Drive the Heardle timer bar with `scaleX`, not `width`

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (`src/client/components/RoundTimer.tsx`), ~10 lines

## Problem

`WindowBar` is repainted from a `requestAnimationFrame` loop for the entire
answer window, and the property it changes every frame is `width`.

```tsx
/* src/client/components/RoundTimer.tsx:174-188 — current */
  const played = idle ? 0 : Math.min(elapsedMs / windowMs, 1) * 100;
  const music = Math.min(audibleMs / windowMs, 1) * 100;

  return (
    <div className="relative h-3 w-full bg-grey-100" role="timer" aria-label={label}>
      {/* Where the music reaches, so the quiet stretch reads as part of the
          round rather than a preview that died. */}
      <span className="absolute inset-y-0 left-0 bg-grey-300" style={{ width: `${music}%` }} />
      <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${played}%` }} />
      <span
        className="absolute inset-y-0 w-px bg-accent"
        style={{ left: `${music}%` }}
        aria-hidden
      />
    </div>
  );
```

The `elapsedMs` that feeds `played` is set from rAF on every frame:

```tsx
/* src/client/components/RoundTimer.tsx:52-63 — current, for context only */
    let frame = 0;
    const tick = () => {
      const now = serverNow();
      setElapsedMs(Math.min(Math.max(now - startAt, 0), windowMs));
      if (now < deadlineAt) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
```

`width` is a layout property: changing it forces layout → paint → composite,
sixty times a second, for the whole round — on a phone that is also decoding and
playing audio, and re-rendering a React subtree on the same tick. `transform` is
composite-only. This is the audit's flat rule: **animate `transform` and
`opacity` only**.

Only the ink bar has this problem. `music` changes at most a handful of times
per round (when a player buys an unlock level) and the red marker moves with it,
so those two are not hot and are deliberately left alone.

`SecondBar` (the Quiz clock, `src/client/components/RoundTimer.tsx:121-155`) is
not affected — its blocks change a class once per second, not a geometry every
frame.

## Target

```tsx
/* target — src/client/components/RoundTimer.tsx, replacing lines 174-188 */
  // A fraction, not a percentage: this one is spent as a transform, because it
  // is the only value here that changes every frame.
  const played = idle ? 0 : Math.min(elapsedMs / windowMs, 1);
  const music = Math.min(audibleMs / windowMs, 1) * 100;

  return (
    <div className="relative h-3 w-full bg-grey-100" role="timer" aria-label={label}>
      {/* Where the music reaches, so the quiet stretch reads as part of the
          round rather than a preview that died. */}
      <span className="absolute inset-y-0 left-0 bg-grey-300" style={{ width: `${music}%` }} />
      {/* The clock hand. Full width and squashed from the left rather than
          grown by width: this is redrawn on every animation frame for the whole
          round, and width would cost a layout pass each time where a transform
          costs none. Its two neighbours move only when a level is bought, so
          they stay on the simpler property. */}
      <span
        className="absolute inset-y-0 left-0 w-full origin-left bg-ink"
        style={{ transform: `scaleX(${played})`, willChange: "transform" }}
      />
      <span
        className="absolute inset-y-0 w-px bg-accent"
        style={{ left: `${music}%` }}
        aria-hidden
      />
    </div>
  );
```

Three details that matter and must not be simplified away:

- `origin-left` (Tailwind for `transform-origin: left`) — without it the bar
  grows from its centre in both directions and the clock reads backwards.
- `w-full` — the element must be full width for `scaleX` to be a fraction of the
  track.
- `willChange: "transform"` — this element animates continuously for the whole
  round, which is the case `will-change` exists for. Do not add it to the other
  two spans, which are static for long stretches.

## Repo conventions to follow

- Layout is Tailwind utility classes; only values computed from data go in an
  inline `style`. `src/client/components/UnlockLadder.tsx:59-64` is the exemplar
  — classes for everything static, `style={{ height: … }}` for the one computed
  number.
- Comments explain the reasoning behind a choice, in full sentences. The
  existing comment inside this very function
  (`src/client/components/RoundTimer.tsx:179-180`) sets the tone.

## Steps

1. In `src/client/components/RoundTimer.tsx`, change line 174 so `played` is a
   0–1 fraction: drop the trailing `* 100`, and add the two-line comment above
   it as shown in **Target**.
2. Leave line 175 (`music`) exactly as it is, percentage and all.
3. Replace the single-line ink `<span>` (line 182) with the multi-line version
   from **Target**, comment included.
4. Leave the `bg-grey-300` span (line 181) and the `bg-accent` marker span
   (lines 183-187) untouched.
5. Change nothing else in the file — in particular, do not touch the rAF effect.

## Boundaries

- Do NOT touch `SecondBar`, the `RoundTimer` component body, or the
  `useEffect` rAF loop. Replacing the rAF loop with a CSS animation is a
  plausible idea and is **out of scope**: the countdown is tied to a
  server-authoritative deadline via `serverNow()`, and moving it to CSS would
  desynchronise it from the server clock the whole game is built on.
- Do NOT add a CSS `transition` to the ink bar. It is repositioned every frame
  already; a transition on top would lag the true clock position.
- Do NOT convert the `music` or marker spans to transforms.
- Do NOT change any file other than `src/client/components/RoundTimer.tsx`.
- If the excerpt above does not match what you find, STOP and report.

## Verification

- **Mechanical**: `npm run typecheck`, `npm run lint`, and `npm run test` all
  pass.
- **Feel check**: run `npm run dev`, start a **Heardle** match (the continuous
  bar only appears when `stagesMs` is non-empty — Quiz shows the block bar
  instead), and during a live round:
  - The ink bar must fill left → right and reach the full track exactly as the
    countdown hits 0. If it grows from the middle, `origin-left` is missing; if
    it is full from the start, `w-full` is being applied without the transform.
  - Buy an unlock level mid-round and confirm the grey `music` stretch and the
    red marker still jump to their new position correctly.
  - Open DevTools → Performance, record ~10 seconds of a live round, and confirm
    the frames during the countdown show no "Layout" entries attributable to the
    timer. Before this change they appear on essentially every frame.
  - Confirm at a glance that the bar is still visually identical to before —
    this change should be invisible to the eye and only visible in the profiler.
- **Done when**: a Performance recording of a live Heardle round shows the
  timer bar compositing without per-frame layout, and the bar's appearance is
  unchanged.
