# 003 — Let the round and the reveal arrive instead of cutting

- **Status**: DONE
- **Commit**: 9cd32da
- **Severity**: HIGH
- **Category**: Missed opportunity / Purpose
- **Estimated scope**: 3 files (`src/app/globals.css`, `PlayScreen.tsx`, `RevealScreen.tsx`), ~20 lines
- **Depends on**: plan 001 (uses `--duration-enter` and `--ease-out`)

## Problem

Every screen in a match is mounted and unmounted by a bare conditional, with no
transition of any kind. Ten times a match the entire page hard-cuts.

```tsx
/* src/app/page.tsx:92-108 — current */
      {game.room?.round && (phase === "loading" || phase === "playing") && (
        <PlayScreen
          room={game.room}
          …
        />
      )}

      {game.room && phase === "reveal" && (
        <RevealScreen room={game.room} playerId={game.playerId} />
      )}
```

The reveal is the moment the whole design is built around — its own file says so:

```tsx
/* src/client/components/RevealScreen.tsx:11-15 — current */
/**
 * The moment the whole Lockstep design exists for: every player finds out at
 * the same instant. Correct and wrong are told apart by weight and a
 * strikethrough, not by colour.
 */
```

…and it teleports in. The answer, the artwork and the standings all replace the
play screen in a single frame, and the next round replaces the reveal the same
way. This is the single largest reason the game feels flat: nothing on screen
ever *arrives*, so the rhythm of round → answer → round has no punctuation.

The repo already has the right gesture and only uses it on the home screen:

```css
/* src/app/globals.css:202-211 — current, used only by HomeScreen */
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(0.75rem);
  }
}

.rise {
  animation: rise 420ms cubic-bezier(0.2, 0, 0, 1) backwards;
}
```

420ms and 0.75rem are right for a first-load poster and too much for something
seen ten times in three minutes, which is why this plan adds a shorter sibling
rather than reusing `.rise`.

## Target

### 1. A shorter entrance, in `src/app/globals.css`

Add directly below the existing `.rise` rule:

```css
/* target */
/**
 * The same gesture as `.rise`, cut down for something seen ten times a match.
 *
 * A round and its answer are the two beats this game keeps time with, and with
 * no transition between them the page simply swapped and the rhythm was gone.
 * Half the distance and half the duration of the home screen's entrance: enough
 * to punctuate, not enough to sit through. `backwards` holds a delayed part
 * hidden through its own delay rather than letting it flash before its turn.
 *
 * The reduced-motion rule above collapses this to nothing.
 */
@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(0.375rem);
  }
}

.enter {
  animation: enter var(--duration-enter) var(--ease-out) backwards;
}
```

### 2. `src/client/components/PlayScreen.tsx`

Current root element:

```tsx
/* src/client/components/PlayScreen.tsx:76-78 — current */
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-12">
```

Target:

```tsx
/* target */
  return (
    // Keyed by round so the entrance re-fires each time, rather than only on
    // the first mount of the match.
    <div key={round.index} className="enter flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-12">
```

### 3. `src/client/components/RevealScreen.tsx`

Current root element:

```tsx
/* src/client/components/RevealScreen.tsx:26-29 — current */
  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-6">
        <FieldLabel>{t("theAnswer")}</FieldLabel>
```

Target — the root animates, and the standings column follows the answer by one
stagger step, so the song lands first and the scores land second:

```tsx
/* target */
  return (
    <div key={reveal.index} className="grid gap-10 md:grid-cols-12 md:gap-8">
      <section className="enter md:col-span-6">
        <FieldLabel>{t("theAnswer")}</FieldLabel>
```

and the second section, currently:

```tsx
/* src/client/components/RevealScreen.tsx:54 — current */
      <section className="md:col-span-6">
        <FieldLabel>{shared ? t("teamScore") : t("standings")}</FieldLabel>
```

becomes:

```tsx
/* target */
      {/* One step behind the answer: the song is what everyone looks at first,
          and the scores mean more once you know what the song was. */}
      <section className="enter md:col-span-6" style={{ animationDelay: "60ms" }}>
        <FieldLabel>{shared ? t("teamScore") : t("standings")}</FieldLabel>
```

60ms is a deliberate value — a stagger below 30ms is invisible and above 80ms
starts to read as a queue. Do not change it.

## Repo conventions to follow

- Entrance animation is a CSS class plus an inline `animationDelay`, applied at
  the call site because only the call site knows the reading order. The
  exemplar is `src/client/components/HomeScreen.tsx:83-86`:

  ```tsx
            className="rise mt-6 max-w-md text-pretty text-grey-500"
            style={{
              animationDelay: `${STAGGER_MS}ms`,
  ```

- Keyframes and their classes live at the bottom of `src/app/globals.css`,
  outside `@layer utilities`, each with a block comment explaining the
  reasoning. See the `.rise` comment at `src/app/globals.css:192-201`.
- Components in this repo take a single leading `"use client"` and are
  documented with a block comment; do not add or remove those.

## Steps

1. In `src/app/globals.css`, add the `@keyframes enter` block and `.enter` rule
   from **Target** immediately after the existing `.rise` rule (currently ending
   at line 211) and before the comment block for `swap-forward`.
2. In `src/client/components/PlayScreen.tsx`, change the root `<div>` at line 77
   to `<div key={round.index} className="enter flex flex-col gap-8">` and add the
   two-line comment above it as shown.
3. In `src/client/components/RevealScreen.tsx`, add `key={reveal.index}` to the
   root `<div>` at line 27 (its className is unchanged), add `enter ` to the
   className of the first `<section>` at line 28, and add `enter ` plus the
   `animationDelay: "60ms"` style and its comment to the second `<section>` at
   line 54.
4. Nothing in `src/app/page.tsx` changes.

## Boundaries

- Do NOT install a motion library (Framer Motion, Motion, React Spring). This
  repo has no runtime animation dependency and is not getting one.
- Do NOT attempt an *exit* animation. Nothing here can outlive its unmount
  without a presence wrapper, and adding one would mean holding stale round data
  on screen while the server has moved on — which is exactly what the phase-driven
  render in `src/app/page.tsx` is designed to prevent. Entrances only.
- Do NOT touch `src/app/page.tsx`.
- Do NOT add `.enter` to `LobbyScreen`, `FinishedScreen`, `HomeScreen`,
  `SongRecap` or any lobby component — this plan is the play/reveal pair only.
- Do NOT change `.rise` or the home screen's `STAGGER_MS`.
- Do NOT add `.enter` to any child of `PlayScreen` — one entrance for the screen,
  not one per section. The play screen's parts are read together, not in order.
- If a file does not match the excerpts above, STOP and report.

## Verification

- **Mechanical**: `npm run typecheck` and `npm run lint` both pass.
  `npm run test` still passes (10 test files; none touch these components, so a
  failure means something unrelated broke).
- **Feel check**: run `npm run dev`, open two browser windows, create a room in
  one and join from the other, start a 3-round match on Quiz.
  - Each new round: the whole play screen should lift ~6px and fade in over
    ~240ms. It must fire on **every** round, not just the first — if rounds 2
    and 3 hard-cut, the `key` in step 2 is missing or wrong.
  - Each reveal: the song title and artwork arrive, then the standings a beat
    later. In DevTools → Animations, set playback speed to 10% and confirm the
    two columns are offset and not simultaneous.
  - Watch for the artwork causing a layout shift as it loads mid-animation. If
    the standings column jumps, report it — do not fix it by removing the
    animation.
  - Toggle DevTools → Rendering → `prefers-reduced-motion: reduce` and confirm
    both screens appear instantly, fully opaque, with no slide (this requires
    plan 002 to have landed).
- **Done when**: every round boundary and every reveal in a full match is
  punctuated by the entrance, and no screen appears half-transparent or offset
  at rest.
