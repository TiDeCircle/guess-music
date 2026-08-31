# 001 — Name the app's motion in `@theme` tokens

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`src/app/globals.css`), ~25 lines added, 3 lines changed

## Problem

There are no motion tokens. Three different easing curves and four different
durations are hand-typed across three places, and a fourth curve is injected
invisibly by Tailwind into every `transition-colors` in the app.

```css
/* src/app/globals.css:155-162 — current */
  .press {
    transition-property: color, background-color, border-color, scale;
    transition-duration: 140ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  .press:active:not(:disabled) {
    scale: 0.96;
  }
```

```css
/* src/app/globals.css:209-211 — current */
.rise {
  animation: rise 420ms cubic-bezier(0.2, 0, 0, 1) backwards;
}
```

```css
/* src/app/globals.css:236-242 — current */
.swap-from-right {
  animation: swap-forward 180ms ease-out;
}

.swap-from-left {
  animation: swap-back 180ms ease-out;
}
```

And the bare `transition-colors` utility — used at 15 call sites including
`src/client/components/PlayScreen.tsx:168`,
`src/client/components/UnlockLadder.tsx:61` and
`src/client/components/RoundTimer.tsx:138` — silently resolves to Tailwind's
own defaults, which are **not** this app's curve:

```css
/* node_modules/tailwindcss/theme.css:492-493 — what every `transition-colors` currently uses */
  --default-transition-duration: 150ms;
  --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

So the app has a house curve (`cubic-bezier(0.2, 0, 0, 1)`) that most of its
actual motion does not use. Every plan after this one needs named values to
refer to, which is why this goes first.

## Target

Add a motion block to the existing `@theme` in `src/app/globals.css`, directly
after the `--text-*` sizes and before the closing brace.

**The house curve keeps its exact current value** — `cubic-bezier(0.2, 0, 0, 1)`
is already a strong ease-out and is used consistently by `.press` and `.rise`.
This plan names it; it does not change it.

```css
/* target — inside the existing @theme block */

  /* Motion, named.
   *
   * One curve does nearly all the work, because this design has one kind of
   * motion: something arrives, or a state settles. `--ease-in-out` is here for
   * the one case that is neither — something already on screen moving to a new
   * place — and is unused until something needs it.
   *
   * Overriding Tailwind's two `--default-transition-*` tokens is the point of
   * the block: every bare `transition-colors` in the app resolves through them,
   * so this is what stops fifteen call sites from quietly running on Tailwind's
   * curve instead of ours. */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

  --duration-press: 140ms;   /* a control giving way under a finger */
  --duration-state: 200ms;   /* a cell settling into a new state */
  --duration-enter: 240ms;   /* a screen or a panel arriving */
  --duration-swap: 180ms;    /* stepping sideways between two panels */
  --duration-hero: 420ms;    /* the home screen's opening statement, alone */

  --default-transition-duration: var(--duration-state);
  --default-transition-timing-function: var(--ease-out);
```

Then rewrite the three existing motion rules to use the tokens:

```css
/* target — src/app/globals.css, replacing the current .press */
  .press {
    transition-property: color, background-color, border-color, scale;
    transition-duration: var(--duration-press);
    transition-timing-function: var(--ease-out);
  }
```

```css
/* target — replacing the current .rise */
.rise {
  animation: rise var(--duration-hero) var(--ease-out) backwards;
}
```

```css
/* target — replacing the current .swap-from-* pair */
.swap-from-right {
  animation: swap-forward var(--duration-swap) var(--ease-out);
}

.swap-from-left {
  animation: swap-back var(--duration-swap) var(--ease-out);
}
```

### Why these names and not others — and one trap

Three separate behaviours here, all verified by compiling a probe file against
this repo's exact Tailwind version. Do not assume, and do not "simplify" any of
them:

1. **`--ease-*` IS a Tailwind v4 theme namespace.** Declaring `--ease-out`
   **overrides Tailwind's built-in `ease-out` utility** (which ships as
   `cubic-bezier(0, 0, 0.2, 1)`). That override is intended — no component
   currently uses an `ease-out` class, so nothing changes behaviour behind your
   back, and from here on `ease-out` in a `className` means the house curve.

2. **`--duration-*` is NOT a Tailwind namespace.** These are plain custom
   properties: `@theme` emits them to `:root` and they work anywhere in CSS as
   `var(--duration-state)`, but **`duration-state` is not a utility class** and
   `@apply duration-state` fails the build with
   `Cannot apply unknown utility class`. A component that needs one of these in
   a `className` must write the arbitrary form:

   ```tsx
   /* how a component uses a duration token — verified to compile */
   className="transition-colors duration-[var(--duration-press)]"
   ```

3. **The two `--default-transition-*` overrides are the load-bearing part.**
   Every bare `transition-colors` in the app compiles to
   `transition-duration: var(--tw-duration, var(--default-transition-duration))`,
   so overriding those two tokens is what redirects fifteen existing call sites
   onto the house curve without editing fifteen files.

## Repo conventions to follow

- All design tokens live in the single `@theme` block at the top of
  `src/app/globals.css` (lines 12-31). Add to it; do not create a second block
  and do not create a new file.
- Every token in that block carries a comment explaining *why* the value is what
  it is, not what it is — see the `--color-grey-500` comment at
  `src/app/globals.css:22-24` for the tone to match. Comments in this repo are
  full sentences and explain reasoning.
- Utilities go in the `@layer utilities` block (`src/app/globals.css:129-163`);
  raw component classes like `.rise` sit outside it at the bottom of the file.
  Keep that arrangement.

## Steps

1. In `src/app/globals.css`, inside the existing `@theme { … }` block, after the
   `--text-display: 5.5rem;` line, add the motion token block from **Target**
   verbatim, comment included.
2. Replace the `.press` rule (currently at lines 155-159, inside
   `@layer utilities`) with the token version from **Target**. Leave
   `.press:active:not(:disabled) { scale: 0.96; }` exactly as it is.
3. Replace the `.rise` rule (currently at lines 209-211) with the token version.
4. Replace both `.swap-from-right` and `.swap-from-left` rules (currently at
   lines 236-242) with the token versions.
5. Do not touch any `.tsx` file.

## Boundaries

- Do NOT touch any file other than `src/app/globals.css`.
- Do NOT change the numeric value of `cubic-bezier(0.2, 0, 0, 1)`, `140ms`,
  `420ms`, or `180ms` — this plan names existing values, it does not retune them.
  `--duration-state` and `--duration-enter` are the only new numbers.
- Do NOT change the `@keyframes rise`, `@keyframes swap-forward`, or
  `@keyframes swap-back` bodies.
- Do NOT touch the `@media (prefers-reduced-motion: reduce)` block — that is
  plan 002.
- Do NOT add dependencies or change `postcss.config.mjs` / `next.config.ts`.
- If the `@theme` block or the three rules do not look like the excerpts above,
  STOP and report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `npm run typecheck` — passes (no `.ts`/`.tsx` changed, so this is a smoke
    test only).
  - `npm run build` — completes. Then confirm the tokens actually landed in the
    production CSS chunk:

    ```bash
    grep -o -- "--default-transition-[a-z-]*:[^;]*" .next/static/chunks/*.css
    ```

    It must print `--default-transition-duration: var(--duration-state)` and
    `--default-transition-timing-function: var(--ease-out)`. If it prints
    `150ms` or `cubic-bezier(0.4, 0, 0.2, 1)`, the `@theme` override did not
    take — STOP and report. (Built CSS lands in `.next/static/chunks/`, not
    `.next/static/css/`.)
- **Feel check**: run `npm run dev`, open the app, and hover the language
  buttons in the header and the playlist tiles in the lobby.
  - The colour change should read very slightly slower and softer than before
    (200ms on the house curve, up from Tailwind's 150ms). It should not read as
    sluggish; if it does, that is a signal for a later plan, not a reason to
    change the value here.
  - Press and hold a `Button` — the 0.96 scale must still feel identical to
    before this change. Any difference means step 2 went wrong.
- **Done when**: no hardcoded `cubic-bezier`, `140ms`, `180ms`, or `420ms`
  remains outside the `@theme` block in `src/app/globals.css`, and the built CSS
  contains the new default transition tokens.

> **Note for later plans**: `duration-state`, `duration-press` and
> `duration-enter` are **not** usable as class names. In a `className`, write
> `duration-[var(--duration-state)]`. In CSS, write `var(--duration-state)`.
