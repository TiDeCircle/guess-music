# 007 — Make spending an unlock level visible

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 2 files (`src/app/globals.css`, `UnlockLadder.tsx`), ~25 lines
- **Depends on**: plan 001 (`--duration-state`, `--ease-out`), plan 002

## Problem

Buying a level is, by the component's own account, the only decision the mode
asks the player to make:

```tsx
/* src/client/components/UnlockLadder.tsx:6-12 — current */
 * Drawn as steps that grow, so the trade is visible without arithmetic — the
 * block you are standing on is how much music you get, and the number above it
 * is what the round is still worth. Spending a level is the only decision this
 * mode asks you to make, so it gets the space.
```

What actually happens when you spend one: a block changes colour, and the points
figure above it replaces itself with a smaller number in the same frame.

```tsx
/* src/client/components/UnlockLadder.tsx:46-55 — current */
        <span className="flex items-baseline gap-2">
          <span className="label text-grey-500">{t("pointsNow")}</span>
          <span
            className="numeric font-semibold"
            style={{ fontSize: "var(--text-title)" }}
          >
            {nowPoints}
          </span>
        </span>
```

```tsx
/* src/client/components/UnlockLadder.tsx:57-66 — current */
      <div className="mt-2 flex h-16 items-end gap-px" aria-hidden>
        {stagesMs.map((ms, i) => (
          <span
            key={ms}
            className={`flex-1 transition-colors ${
              i === level ? "bg-accent" : i < level ? "bg-grey-300" : "bg-grey-100"
            }`}
            style={{ height: `${((i + 1) / stagesMs.length) * 100}%` }}
          />
        ))}
      </div>
```

You paid points for more music and the interface acknowledged it with a repaint.
The number in particular is the cost you just agreed to, and watching 100 become
60 with no transition at all reads as a glitch rather than a price.

Unlike the answer grid and the player strip, **this container is safe for
transforms**: line 57 is `flex h-16 items-end gap-px` with no `bg-ink` behind
it, so the 1px gaps are the page ground and a scaling child opens nothing.

## Target

### 1. Two small animations in `src/app/globals.css`

Add at the bottom of the file, after the `.swap-from-*` rules:

```css
/* target */
/**
 * The Heardle ladder, acknowledging a purchase.
 *
 * The step just bought rises into place instead of appearing already there, and
 * the points figure it cost is replaced rather than swapped — a number that
 * changes value in one frame reads as a glitch, and this one is a price the
 * player has just agreed to pay.
 *
 * Both are keyframes rather than transitions, which is normally the wrong
 * choice for anything a player can trigger repeatedly. It is right here because
 * a purchase is rate-limited by a server round trip: there is no way to spend
 * two levels inside 200ms, so there is no interruption to retarget.
 *
 * The step starts at 0.85 rather than 0 — a block that grows out of nothing
 * belongs to no physical world, and the ladder is meant to read as steps.
 *
 * The reduced-motion rule above collapses both to nothing.
 */
@keyframes step-up {
  from {
    transform: scaleY(0.85);
  }
}

@keyframes tick {
  from {
    opacity: 0;
  }
}

.step-up {
  transform-origin: bottom;
  animation: step-up var(--duration-state) var(--ease-out);
}

/* Opacity only, deliberately: a figure that slid under its fixed label would
   be the noisiest thing on a screen that already has a clock running. */
.tick {
  animation: tick var(--duration-state) var(--ease-out);
}
```

### 2. `src/client/components/UnlockLadder.tsx`

The points figure, replacing lines 48-53:

```tsx
/* target */
          <span
            // Keyed by value so the figure is replaced rather than mutated:
            // this is what the level just cost, and it should land, not blink.
            key={nowPoints}
            className="numeric tick font-semibold"
            style={{ fontSize: "var(--text-title)" }}
          >
            {nowPoints}
          </span>
```

The ladder steps, replacing lines 58-65:

```tsx
/* target */
        {stagesMs.map((ms, i) => (
          <span
            // The block being stood on is re-keyed when the level moves, so the
            // step that was just bought is the only one that animates.
            key={i === level ? `${ms}-${level}` : ms}
            className={`flex-1 transition-colors ${
              i === level ? "step-up bg-accent" : i < level ? "bg-grey-300" : "bg-grey-100"
            }`}
            style={{ height: `${((i + 1) / stagesMs.length) * 100}%` }}
          />
        ))}
```

The re-key is what makes the keyframe fire again on each purchase; without it
React reuses the DOM node, the animation has already run, and only the colour
changes — which is the current behaviour.

## Repo conventions to follow

- Keyframes and their classes live at the bottom of `src/app/globals.css`,
  outside `@layer utilities`, each introduced by a block comment giving the
  reasoning. The `.rise` comment at `src/app/globals.css:192-201` is the model
  for length and voice.
- Durations and curves come from the `@theme` tokens added in plan 001, never
  hand-typed.
- In components, computed values go in `style`, everything else in classes —
  `UnlockLadder.tsx:59-64` already does exactly this and keeps that shape here.

## Steps

1. In `src/app/globals.css`, append the `@keyframes step-up`, `@keyframes tick`,
   `.step-up` and `.tick` block from **Target** to the end of the file, comments
   included.
2. In `src/client/components/UnlockLadder.tsx`, add `key={nowPoints}`, the
   `tick` class and the two-line comment to the points `<span>` at lines 48-53.
3. In the same file, change the ladder step `<span>`'s `key` to the conditional
   form, add `step-up ` to the active branch of its className, and add the
   two-line comment — all as shown in **Target**.
4. Change nothing else in either file.

## Boundaries

- Do NOT animate the step `height`. It is computed per step from the stage count
  and is a layout property; the `scaleY` in `.step-up` is the whole point of
  this plan.
- Do NOT add `.step-up` to the inactive steps. Only the level just bought
  animates; a whole ladder re-animating on every purchase is a light show.
- Do NOT touch the second row of `<span>`s (the seconds labels,
  `UnlockLadder.tsx:68-79`) — those are a static scale, not a state.
- Do NOT animate the two buttons at the bottom of the component
  (`UnlockLadder.tsx:82-108`); their `transition-colors` is already correct and
  picks up the house tokens from plan 001.
- Do NOT change `heardleTierPoints` or any scoring logic. `npm run test`
  includes `tests/heardle.test.ts` and `tests/scoring.test.ts` — nothing in this
  plan should be able to affect them.
- Do NOT touch `src/client/components/PlayScreen.tsx`.
- If the excerpts do not match, STOP and report.

## Verification

- **Mechanical**: `npm run typecheck`, `npm run lint`, `npm run test` pass —
  including `tests/heardle.test.ts` and `tests/scoring.test.ts` unchanged.
- **Feel check**: run `npm run dev`, start a **Heardle** match (Quiz does not
  render this component — it is gated on `mode.typed` at
  `src/client/components/PlayScreen.tsx:97`), and during a live round:
  - Press *unlock* and watch the ladder: the newly-red block should rise from
    its base, not appear at full height. In DevTools → Animations at 10%
    playback, confirm it scales from the bottom edge — if it grows from the
    centre, `transform-origin: bottom` is missing.
  - Confirm the points figure fades in with the new value rather than swapping
    digits, and that it does **not** shift position while it does (the
    `.numeric` class sets tabular figures; if the number jitters horizontally,
    something has overridden that).
  - Buy every remaining level in quick succession. Each purchase must animate;
    none should be skipped or left mid-animation. If a step ever animates twice
    or a stale block stays red, the `key` expression in step 3 is wrong.
  - Confirm the 1px gaps between ladder steps show the page ground and never a
    black seam during the scale.
  - With `prefers-reduced-motion: reduce` emulated, the step must appear
    instantly at full height and the figure at full opacity — nothing stuck
    small or invisible.
- **Done when**: every purchase in a Heardle round is acknowledged by both the
  step and the figure, and repeated purchases never leave a block mid-scale.
