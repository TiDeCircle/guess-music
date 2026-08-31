# 002 — Narrow reduced-motion to movement, keep colour and opacity

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`src/app/globals.css`), ~12 lines changed

## Problem

The reduced-motion rule switches off *every* transition in the app, including
the colour and opacity changes that carry meaning rather than movement.

```css
/* src/app/globals.css:165-173 — current */
/* Respect the system setting rather than animating regardless. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`transition-duration: 0.01ms !important` on `*` means a player with reduced
motion enabled gets a hard cut for everything: the answer tile flipping to ink,
the unlock ladder settling, another player's cell filling in on the strip. Those
are exactly the transitions that aid comprehension — WCAG and the audit
playbook both ask for *less and gentler* motion, not none:

> Reduced motion means fewer and gentler animations, **not zero** — keep
> transitions that aid comprehension, remove position changes.

This also blocks plans 005, 006 and 007: every improvement they make would be
invisible to reduced-motion users, so this rule has to be narrowed before those
land or their work is wasted on that audience.

## Target

Replace the whole `@media (prefers-reduced-motion: reduce)` block with:

```css
/* target */
/**
 * Respect the system setting — by dropping movement, not feedback.
 *
 * Blanking every transition was the easy reading of this preference and the
 * wrong one: it takes away the colour changes that tell a player their answer
 * landed and that someone else has locked one in, which are comprehension, not
 * decoration. So the property list is pinned to the things that do not move,
 * and the keyframe animations — all of which translate — are collapsed instead.
 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-property: color, background-color, border-color, outline-color,
      text-decoration-color, fill, stroke, opacity !important;
  }

  /* The one transform this design uses on purpose. A 4% shrink with no
     transition left to soften it is a jump, so it goes rather than snaps. */
  .press:active:not(:disabled) {
    scale: 1 !important;
  }
}
```

Two things to understand about why this works:

- Pinning `transition-property` (rather than zeroing `transition-duration`)
  leaves each element's *authored* duration intact for the properties that
  survive, so a 200ms colour settle stays a 200ms colour settle. Everything
  else — `transform`, `scale`, `width`, `height`, `translate` — simply stops
  being a transitionable property and jumps to its final value, which is the
  correct reduced-motion behaviour.
- `animation-duration: 0.01ms` still collapses `.rise`, `.swap-from-right`,
  `.swap-from-left` and any keyframes added by later plans. All of them are
  written as `from { … }` only, so collapsing them lands on the element's
  natural resting state with nothing left half-applied.

## Repo conventions to follow

- The block sits in `src/app/globals.css` between the `@layer utilities` block
  and the `.option-row` rule. Keep it in the same place.
- Every rule in this file is introduced by a comment saying why it exists, in
  full sentences — see the `:focus-visible` comment at
  `src/app/globals.css:79-92` for the length and tone to match.

## Steps

1. In `src/app/globals.css`, replace lines 165-173 (the comment line
   `/* Respect the system setting rather than animating regardless. */` through
   the closing `}` of the media query) with the block from **Target**, verbatim.
2. Change nothing else in the file.

## Boundaries

- Do NOT touch any file other than `src/app/globals.css`.
- Do NOT remove the `@media (prefers-reduced-motion: reduce)` block or make it
  conditional in JS — this stays pure CSS.
- Do NOT add a `useReducedMotion` hook or any JS media-query listener; there is
  no motion library in this repo and none is being added.
- Do NOT change `.press` outside the media query.
- If the current block does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: `npm run build` completes, then:

  ```bash
  grep -o "prefers-reduced-motion[^}]*}" .next/static/chunks/*.css
  ```

  must show the pinned `transition-property` list and must NOT show
  `transition-duration:.01ms`. (Built CSS lands in `.next/static/chunks/`, not
  `.next/static/css/`.)
- **Feel check**: run `npm run dev`, open DevTools → Rendering → *Emulate CSS
  media feature prefers-reduced-motion: reduce*, then:
  - Hover a playlist tile in the lobby and a language button in the header —
    the colour must still ease, not cut. This is the whole point of the change.
  - Press and hold any `Button` — it must **not** shrink at all (no jump, no
    animation).
  - Reload the home screen — the four `.rise` parts must appear instantly and
    fully, with no upward slide and nothing stuck invisible.
  - Open the playlist picker and step into a language group — the panel must
    appear with no sideways slide, and must not be blank.
  - Then turn the emulation off and confirm all four behave as they did before.
- **Done when**: with reduced motion on, no element translates or scales, and
  colour transitions still run at their authored duration.
