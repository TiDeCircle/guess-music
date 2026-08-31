# 005 — Let the player strip and the round dots settle instead of snapping

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 2 files (`PlayerStrip.tsx`, `RoundDots.tsx`), ~4 lines
- **Depends on**: plan 001 (`duration-state`), plan 002 (or the effect is invisible under reduced motion)

## Problem

The two components that report what is happening *right now* have no transition
at all — not a slow one, none.

```tsx
/* src/client/components/PlayerStrip.tsx:40-46 — current */
          const done = loading ? ready.has(p.id) : answered.has(p.id);
          return (
            <div
              key={p.id}
              className={`flex items-baseline justify-between gap-2 p-3 ${
                done ? "bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
```

```tsx
/* src/client/components/RoundDots.tsx:33-43 — current */
          return (
            <span
              key={i}
              title={`${t("round")} ${i + 1}`}
              className={`relative h-6 flex-1 ${
                isCurrent
                  ? "bg-accent"
                  : outcome === "correct"
                    ? "bg-ink"
                    : outcome === undefined
                      ? "bg-grey-100"
                      : "bg-grey-300"
              }`}
            >
```

When another player locks an answer in, their cell goes from paper to solid ink
in one frame. The component's own documentation says this is the feature that
makes the game feel like a game:

```tsx
/* src/client/components/PlayerStrip.tsx:17-20 — current */
 * Who has locked an answer in is the one thing that makes a Lockstep round feel
 * like a race — without it a player stares at four options with no sense that
 * anyone else is there.
```

A cell that blinks black is a rendering artefact; a cell that *fills* is another
person doing something. The information is identical and the reading is not.
Same for the round dots, where the red current-round marker jumps a slot with no
sense of having moved along.

Note that both of these grids draw their dividing lines as the container's own
`bg-ink` background — `src/client/components/PlayerStrip.tsx:37` uses
`gap-px bg-ink`. That rules out transform and opacity here, exactly as the
`.press` comment in `src/app/globals.css:143-152` explains: a cell that shrinks
or goes translucent opens a black gash where the gap was. **Colour only.**

## Target

```tsx
/* target — src/client/components/PlayerStrip.tsx, replacing the className on line 43 */
              className={`flex items-baseline justify-between gap-2 p-3 transition-colors ${
                done ? "bg-ink text-paper" : "bg-paper text-ink"
              }`}
```

```tsx
/* target — src/client/components/RoundDots.tsx, replacing the className on line 35 */
              className={`relative h-6 flex-1 transition-colors ${
```

That is the entire change. The bare `transition-colors` utility resolves through
the theme tokens added in plan 001 — `--duration-state` (200ms) on
`--ease-out` (`cubic-bezier(0.2, 0, 0, 1)`) — so no duration or easing class is
needed here, and adding one would fork the value away from the token.

If plan 001 has **not** landed, `transition-colors` will resolve to Tailwind's
own 150ms `cubic-bezier(0.4, 0, 0.2, 1)`. That is still better than no
transition, so this plan is safe to apply on its own; it just does not sit on
the house curve until 001 lands.

Also add a one-line comment above each, in the file's own voice:

```tsx
/* target — src/client/components/PlayerStrip.tsx, above the returned <div> */
            // Filled rather than blinked: a cell that fills reads as another
            // person doing something, and a cell that snaps reads as a glitch.
```

```tsx
/* target — src/client/components/RoundDots.tsx, above the returned <span> */
            // The marker moves along the row rather than jumping between slots.
```

## Repo conventions to follow

- Conditional classes are template literals with the static utilities first and
  the state-dependent ones in the interpolation. Both files already do this;
  keep the shape and put `transition-colors` in the static half.
- Comments are full sentences explaining the reasoning, not the mechanics. See
  `src/client/components/PlayScreen.tsx:163-166` for the tone.

## Steps

1. In `src/client/components/PlayerStrip.tsx`, add `transition-colors` to the
   static half of the `<div>`'s className on line 43, and add the two-line
   comment above the `<div>` at line 42.
2. In `src/client/components/RoundDots.tsx`, add `transition-colors` to the
   static half of the `<span>`'s className on line 35, and add the one-line
   comment above the `<span>` at line 34.
3. Change nothing else in either file.

## Boundaries

- Do NOT add `opacity`, `scale`, `transform`, or any `.press` class to these
  cells. The `gap-px bg-ink` grid makes all three wrong here — see the Problem
  section.
- Do NOT add a stagger. These cells change in response to independent server
  events at unpredictable times; a stagger would imply an ordering that does not
  exist.
- Do NOT animate the score number. It is a text swap, not a state, and a
  cross-fading digit under a `tabular-nums` label is noise.
- Do NOT touch the blank filler cells (`PlayerStrip.tsx:60-67`) — they never
  change state.
- Do NOT touch `src/app/globals.css`.
- If either excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `npm run typecheck`, `npm run lint`, `npm run test` pass.
- **Feel check**: run `npm run dev`, open two windows, join the same room from
  both, and start a Quiz match.
  - Answer in one window and watch the **other** window's player strip: that
    cell should fill to ink over ~200ms. Watch it at DevTools → Animations,
    playback 10%, and confirm both the background and the text colour cross
    together — if the text flips instantly while the background eases, the
    `transition-colors` landed on the wrong element.
  - Play through to round 2 and confirm the red current-round dot slides its
    colour along the row rather than blinking.
  - Confirm the black hairline gaps between the cells stay a constant 1px black
    throughout the transition. Any grey flicker in the gaps means an opacity or
    transform crept in — remove it.
  - With `prefers-reduced-motion: reduce` emulated (and plan 002 applied), the
    fill should still ease. If it hard-cuts, plan 002 has not landed.
- **Done when**: no state change in either component happens in a single frame,
  and the dividing hairlines never flicker.
