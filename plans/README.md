# Animation plans

Produced by an `improve-animations` audit of the **play path** at commit
`9cd32da` — `PlayScreen`, `RoundTimer`, `UnlockLadder`, `PlayerStrip`,
`RoundDots`, `RevealScreen`, and the phase switch in `src/app/page.tsx`.

## The finding behind all of it

The play screen has no motion of its own. Every state change in it is either an
instant colour swap or an instant unmount, and the two screens the game keeps
time with — the round and its answer — replace each other in a single frame. The
app is not badly animated; it is not animated. That is what reads as flat.

The design is Swiss: hard grid, hairline rules, one red, no shadows. **The fix
is not delight, bounce, or springs** — it is punctuation. Every plan here keeps
motion short, structural, and colour-or-transform-only.

## Plans

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-motion-tokens.md) | Name the app's motion in `@theme` tokens | MEDIUM | Cohesion & tokens | DONE |
| [002](002-reduced-motion-scope.md) | Narrow reduced-motion to movement, keep colour and opacity | MEDIUM | Accessibility | DONE |
| [003](003-phase-entrance.md) | Let the round and the reveal arrive instead of cutting | **HIGH** | Missed opportunity | DONE |
| [004](004-timer-bar-transform.md) | Drive the Heardle timer bar with `scaleX`, not `width` | **HIGH** | Performance | DONE |
| [005](005-live-cells.md) | Let the player strip and round dots settle instead of snapping | MEDIUM | Missed opportunity | DONE |
| [006](006-answer-lock-in.md) | Make locking an answer in read as final | MEDIUM | Purpose & feedback | DONE |
| [007](007-unlock-ladder.md) | Make spending an unlock level visible | MEDIUM | Missed opportunity | DONE |

## Execution order

Run in numeric order. It is a dependency order, not a priority order:

```
001 (tokens) ──┬── 003 (phase entrance)   ← biggest visible win
               ├── 006 (answer lock-in)
               └── 007 (unlock ladder)
002 (a11y) ────┴── 005 (live cells)

004 (timer perf) — independent, run any time
```

- **001 first.** 003, 005, 006 and 007 all refer to tokens it creates. Applying
  them first means hand-typed durations that later have to be unpicked.
- **002 before 005/006/007.** Those three add colour and opacity feedback, and
  the current reduced-motion rule blanks all of it. Land out of order and the
  work is invisible to that audience.
- **004 is standalone.** It touches no shared token and no other component, so
  it can go first, last, or in parallel — useful if you want one small
  independently-reviewable change to start with.
- **003 is the one to do if you only do one.** It is the entrance for the round
  and the reveal, ten times a match, and it is where "flat" mostly comes from.

## Two facts every plan depends on

Both verified by compiling probe CSS against this repo's exact Tailwind version
(`tailwindcss` 4.3.x); do not take them on trust from the docs, and do not
"simplify" past them:

1. `--ease-*` **is** a Tailwind v4 theme namespace — declaring `--ease-out` in
   `@theme` overrides the built-in `ease-out` utility repo-wide.
2. `--duration-*` **is not** a namespace. `duration-state` is not a class and
   `@apply duration-state` fails the build. In a `className`, the only spelling
   that compiles is `duration-[var(--duration-state)]`.

## Two constraints that are not negotiable

Both are already documented in the source and were re-confirmed during the
audit. A plan that violates either will produce a visible artefact:

1. **No `transform` and no `opacity` on a cell inside a `gap-px bg-ink` grid.**
   Those grids draw their 1px dividers as the container's own background, so a
   cell that shrinks or goes translucent opens a black gash where the gap was.
   Affects the Quiz option grid (`PlayScreen.tsx:148`) and the player strip
   (`PlayerStrip.tsx:37`). Colour only there. See `src/app/globals.css:143-152`.
   The unlock ladder (`UnlockLadder.tsx:57`) has no ink background and *is* safe
   for transforms — which is why plan 007 uses one and plans 005/006 do not.
2. **Red means "this is happening right now", and nothing else.** It belongs to
   the clock and the live round. Correct and wrong are carried by weight and a
   strikethrough, so the design reads the same to a colour-blind player. No plan
   may introduce green/red result colouring. See `src/app/globals.css:4-11`.

## Deliberately not planned

Recorded so they are not re-proposed as oversights:

- **Exit animations on phase changes.** Nothing can outlive its unmount without
  a presence wrapper, and holding stale round data on screen after the server
  has moved on is exactly what the phase-driven render in `src/app/page.tsx` is
  built to prevent.
- **Replacing the timer's rAF loop with a CSS animation.** The countdown is tied
  to a server-authoritative deadline through `serverNow()`; moving it to CSS
  would desynchronise it from the clock the whole Lockstep design rests on.
- **A motion library.** There is no runtime animation dependency in this repo
  and none of these plans needs one.

## Missed opportunities not yet written up

Grounded in real seams observed during the audit, but each needs a design call
before it is worth specifying:

- **The last five seconds of the answer window do not escalate.** The clock runs
  at one pace to zero. Red already means "now" here, so there is a language for
  urgency — but using it more would spend the design's scarcest colour.
- **The `loading` → `playing` handoff is silent.** The timer sits idle showing a
  static shape and then the clock snaps on, at the exact moment the music
  starts. That instant is the most under-used beat in the game.
- **The reveal artwork just appears.** It is the only photographic element in a
  type-only design, arriving at the one moment per round that could carry
  delight — and it is rendered with none of it.
