# 006 — Make locking an answer in read as final

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: MEDIUM
- **Category**: Purpose & feedback
- **Estimated scope**: 1 file (`src/client/components/PlayScreen.tsx`), ~12 lines
- **Depends on**: plan 001 (`duration-press`, `duration-enter`, `ease-out`), plan 002

## Problem

Committing to an answer is the entire interaction of Quiz mode, and it produces
one 150ms background swap on the tile you tapped. The other three tiles keep
their full-strength ink text and paper ground, so the grid after you have
answered looks almost exactly like the grid before — nothing says the decision
is spent.

```tsx
/* src/client/components/PlayScreen.tsx:150-172 — current */
              {round.choices.map((choice) => {
                const isPicked = picked === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={loading || done || picked !== null}
                    aria-pressed={isPicked}
                    onClick={() => {
                      // Locked in immediately: an answer is final, and showing
                      // that instantly beats waiting for the broadcast.
                      if (picked) return;
                      setPicked(choice.id);
                      onAnswer(round.index, choice.id);
                    }}
                    // Hover must stay clearly weaker than the locked-in state.
                    // When both were solid ink, the tile under a cursor left
                    // over from the previous round looked exactly like an answer
                    // this player had already committed to.
                    className={`group flex min-h-32 flex-col justify-between p-3 text-left transition-colors md:min-h-44 md:p-4 ${
                      isPicked
                        ? "bg-ink text-paper"
                        : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                    }`}
                  >
```

The comment at the top of the handler — *"an answer is final, and showing that
instantly beats waiting for the broadcast"* — states the intent correctly. The
rendering does not carry it out: `disabled:text-grey-500` greys the *text* of
the unpicked tiles but their background stays `bg-paper`, identical to a live,
tappable tile.

There is a hard constraint on the fix. This grid draws its dividing lines as the
container's own background:

```tsx
/* src/client/components/PlayScreen.tsx:148 — current */
            <div className="mt-2 grid grid-cols-2 gap-px bg-ink">
```

so **neither `transform` nor `opacity` may be used on these tiles** — a tile that
shrinks or goes translucent opens a black gash where the 1px gap was. The
`.press` class is excluded from these grids for exactly this reason, documented
at `src/app/globals.css:143-152`. This plan works in colour only.

## Target

Two changes to the tile className, and nothing else.

**1. Unpicked tiles recede once an answer exists.** Distinguish "not yet
answerable" (loading) from "no longer answerable" (you have picked), which the
current single `disabled:` branch cannot do:

```tsx
/* target — replacing the className expression on lines 168-172 */
                    // Hover must stay clearly weaker than the locked-in state.
                    // When both were solid ink, the tile under a cursor left
                    // over from the previous round looked exactly like an answer
                    // this player had already committed to.
                    //
                    // Timing is deliberately lopsided. The tile you chose
                    // confirms at press speed, because that is your own hand
                    // landing; the three you did not choose take the slower
                    // beat to fall back, because that is the screen answering.
                    // Symmetric timing here made the whole grid feel like it
                    // changed by itself.
                    className={`group flex min-h-32 flex-col justify-between p-3 text-left transition-colors md:min-h-44 md:p-4 ${
                      isPicked
                        ? "bg-ink text-paper duration-[var(--duration-press)]"
                        : picked !== null
                          ? "bg-grey-100 text-grey-500 duration-[var(--duration-enter)]"
                          : "bg-paper text-ink enabled:hover:bg-grey-100 disabled:text-grey-500"
                    }`}
```

**2. The artist sub-label follows the same three states.** Currently:

```tsx
/* src/client/components/PlayScreen.tsx:177-183 — current */
                    {showArtist && (
                      <span
                        className={`label mt-3 md:mt-4 ${
                          isPicked ? "text-grey-300" : "text-grey-500"
                        }`}
                      >
```

Target — add the transition so it settles with its tile rather than snapping:

```tsx
/* target */
                    {showArtist && (
                      <span
                        className={`label mt-3 transition-colors md:mt-4 ${
                          isPicked ? "text-grey-300" : "text-grey-500"
                        }`}
                      >
```

### The values

- `--duration-press` = 140ms, `--duration-enter` = 240ms — both are tokens added
  by plan 001. **`--duration-*` is not a Tailwind theme namespace**, so there is
  no `duration-press` class: the arbitrary form
  `duration-[var(--duration-press)]` above is the only spelling that compiles.
  Writing `duration-press` fails the build with
  `Cannot apply unknown utility class`; writing `duration-[140ms]` forks the
  value away from the token. Use exactly what is written above.
- The lopsided pair is deliberate: a deliberate human action confirms fast, the
  system's own response takes longer. Do not equalise them.
- `bg-grey-100` is the existing "quiet ground" token, already used as the hover
  ground on these same tiles, so the receded state and the hover state share a
  value — correct, because after you have answered there is no hover to confuse
  it with.

## Repo conventions to follow

- Nested ternaries in a template-literal className are the established shape in
  this file and in `src/client/components/RoundDots.tsx:36-42`. Three branches
  is within what this codebase already does; do not extract a helper.
- Long explanatory comments sit directly above the `className` they justify —
  the current comment at `PlayScreen.tsx:163-166` is the model.
- State-dependent colours come from the palette tokens (`bg-grey-100`,
  `text-grey-500`); never a hex value, never an opacity utility.

## Steps

1. In `src/client/components/PlayScreen.tsx`, extend the existing comment above
   the tile `className` (lines 163-166) with the second paragraph from
   **Target**.
2. Replace the two-branch ternary in that className with the three-branch
   version from **Target**, including the `duration-[var(--duration-press)]` and
   `duration-[var(--duration-enter)]` utilities, spelled exactly that way.
3. Add `transition-colors` to the artist `<span>`'s className at line 179.
4. Change nothing else. In particular, leave the `disabled` prop, the `onClick`
   handler, and `aria-pressed` exactly as they are.

## Boundaries

- Do NOT add `opacity`, `scale`, `transform`, `.press`, or a `ring`/`shadow` to
  these tiles. The `gap-px bg-ink` grid forbids the first three and this design
  has no shadows at all.
- Do NOT introduce green/red for correct/wrong. Red carries one meaning in this
  app — "this is happening right now" — and it belongs to the clock; the
  correct/wrong language is weight and strikethrough, on the reveal screen, not
  here. This is documented at `src/app/globals.css:4-11`.
- Do NOT reveal whether the answer was right. The player must not learn this
  before the reveal — that is the entire Lockstep design.
- Do NOT change the typed/Heardle branch of this component
  (`PlayScreen.tsx:126-146`) — that is plan 007's neighbourhood.
- Do NOT change `SongSearch.tsx`.
- If the excerpts do not match, STOP and report.

## Verification

- **Mechanical**: `npm run typecheck`, `npm run lint`, `npm run test` pass.
- **Feel check**: run `npm run dev`, start a Quiz match, and on a live round:
  - Tap an option. The tapped tile should go solid ink quickly; the other three
    should drift back to a quiet grey ground more slowly. In DevTools →
    Animations at 10% playback, confirm the two speeds are visibly different and
    that the picked tile finishes first.
  - Confirm the 1px black gaps between the four tiles stay solid black
    throughout — any grey flicker means an opacity or transform got in.
  - Move the mouse over the receded tiles after answering: nothing should
    respond. (They are `disabled`, so this is a regression check on step 4.)
  - During the `loading` phase, before the clock starts, confirm the tiles look
    as they did before this change — grey text on paper, not the receded grey
    ground. If all four go grey during loading, the `picked !== null` branch is
    in the wrong order.
  - With `prefers-reduced-motion: reduce` emulated, the colours must still
    settle, at the same two speeds. If they hard-cut, plan 002 has not landed.
- **Done when**: after answering, the grid reads at a glance as three spent
  options and one committed one, with no black-gap artefacts and no leak of
  whether the answer was correct.
