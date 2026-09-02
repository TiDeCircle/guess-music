# Anime Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth Game Mode whose four options are anime series rather than song titles — you hear the opening, you name the show.

**Architecture:** Series data is curated and shipped, riding on `Track.series` (optional, set only by playlists that supply a mapping). A new `animeMode` builds rounds from distinct series instead of distinct tracks, as a sibling of `buildChoiceRounds` rather than a parameter to it. Mode and Song Source stop being orthogonal, and that coupling is expressed as exactly one boolean (`GameMode.requiresSeries`), one filter in the picker, and one guard in `setConfig`.

**Tech Stack:** TypeScript, Next.js custom server, Socket.IO, Zod, Vitest, Tailwind. Data comes from the iTunes Lookup API and AnimeThemes.moe, both free and unauthenticated.

**Spec:** `docs/superpowers/specs/2026-09-02-anime-mode-design.md` (commit `57e397e`)

## Global Constraints

- **Zero border-radius.** The house style is Swiss: hairline borders, no rounded corners. The single deliberate exception already in the codebase is the reaction bubble in `PlayerStrip.tsx`. Do not add a second.
- **Colours come from CSS custom properties** (`--color-ink`, `--color-paper`, `--color-accent`) via Tailwind's `bg-ink` / `text-paper` / `bg-accent` classes, never hard-coded hex. They flip for dark mode.
- **Every user-facing string goes through `src/client/i18n.ts`** with both a `th` and an `en` entry. `tests/playlists.test.ts` enforces this for playlists; nothing enforces it for modes, so be careful.
- **`PlaylistId` and `playlistSchema` are two sources of truth that must be edited together.** The TypeScript union in `src/shared/types.ts` and the Zod enum in `src/shared/protocol.ts` do not check each other at compile time. The same applies to `GameModeId` and `modeSchema`.
- **Commit messages end with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Stage files by explicit name.** Never `git add -A`; the working tree carries unrelated modifications (`skills-lock.json`, `GAME_UX_CHECKLIST.md`).
- **Run the full suite with** `npm test`, and typecheck with `npm run build`. Node 20 via nvm, with `NODE_OPTIONS=--dns-result-order=ipv4first` for anything that hits the network.
- **Do not deploy.** This plan ends at a pushed branch. Deploying restarts pm2 and destroys every live room; that is a separate, explicitly-requested step.

---

### Task 1: Series data can ride on a Track

Adds the field and the plumbing that fills it, with no anime data in the repo yet. Proven against a synthetic playlist definition so it lands independently.

**Files:**
- Modify: `src/shared/types.ts:7-20` (the `Track` type)
- Modify: `src/data/seeds/index.ts:33-38` (the `tracks` branch of `PlaylistSource`)
- Modify: `src/server/itunes.ts:296-307` (`getFixedTracks`)
- Test: `tests/anime-seed.test.ts` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `Track.series?: string`; `PlaylistSource` `tracks` branch gains `series?: Readonly<Record<string, string>>`; `getFixedTracks(key, ids, country, series?)` returns tracks with `series` stamped.

- [ ] **Step 1: Write the failing test**

Create `tests/anime-seed.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearItunesCache, getFixedTracks } from "@/server/itunes";

const RESULT = (id: number, name: string) => ({
  trackId: id,
  trackName: name,
  artistName: "YOASOBI",
  artistId: 99,
  artworkUrl100: "https://example.test/100x100bb.jpg",
  previewUrl: `https://example.test/${id}.m4a`,
  releaseDate: "2021-07-02",
  kind: "song",
});

describe("getFixedTracks with a series map", () => {
  beforeEach(() => {
    clearItunesCache();
    vi.restoreAllMocks();
  });

  it("stamps the series named for each id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ results: [RESULT(1, "Gunjou"), RESULT(2, "Monster")] })),
      ),
    );

    const tracks = await getFixedTracks("t1", ["1", "2"], "TH", { "1": "BLUE PERIOD" });

    expect(tracks.find((t) => t.id === "1")?.series).toBe("BLUE PERIOD");
    // A track the map says nothing about stays plain, rather than guessing.
    expect(tracks.find((t) => t.id === "2")?.series).toBeUndefined();
  });

  it("leaves every track plain when no map is given", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [RESULT(1, "Gunjou")] }))),
    );

    const tracks = await getFixedTracks("t2", ["1"], "TH");

    expect(tracks[0]?.series).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/anime-seed.test.ts`
Expected: FAIL — `getFixedTracks` takes three arguments, so TypeScript rejects the fourth.

- [ ] **Step 3: Add the field to `Track`**

In `src/shared/types.ts`, inside the `Track` type after `year`:

```ts
  /**
   * Which anime this song is from. Present only on Tracks that came from a
   * Playlist shipping a series map — every other Playlist leaves it unset,
   * because iTunes has nothing to say about it and a guess would be worse
   * than a blank.
   */
  series?: string;
```

- [ ] **Step 4: Let a curated Playlist carry the mapping**

In `src/data/seeds/index.ts`, in the `tracks` branch of `PlaylistSource`, after `trackIds`:

```ts
      /**
       * iTunes track id to the name of the anime it is from. Only the anime
       * Playlists fill this in; it is what makes `requiresSeries` modes
       * playable at all.
       */
      series?: Readonly<Record<string, string>>;
```

- [ ] **Step 5: Stamp it after the lookup**

In `src/server/itunes.ts`, replace `getFixedTracks` with:

```ts
export async function getFixedTracks(
  key: string,
  ids: readonly string[],
  country: string,
  series?: Readonly<Record<string, string>>,
): Promise<Track[]> {
  const hit = fixedCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const tracks = dedupeByTitle(await lookupTracks(ids, country)).map((t) => {
    const name = series?.[t.id];
    return name ? { ...t, series: name } : t;
  });
  fixedCache.set(key, { at: Date.now(), value: tracks });
  return tracks;
}
```

- [ ] **Step 6: Pass it through from the catalog**

In `src/server/catalog.ts`, in `buildPool`, replace the `tracks` branch:

```ts
  } else if (source.kind === "tracks") {
    // No randomisation here: the list is the playlist. Variety between matches
    // comes from the recently-played filter in the round builder.
    tracks = await getFixedTracks(playlist, source.trackIds, source.country, source.series);
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/anime-seed.test.ts && npm test`
Expected: PASS, and no other suite regresses.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types.ts src/data/seeds/index.ts src/server/itunes.ts src/server/catalog.ts tests/anime-seed.test.ts
git commit -m "$(cat <<'EOF'
Let a curated playlist say what each song is from

iTunes returns a title, an artist, artwork and a date, and nothing that
says "Frieren". So the mapping is curated and shipped, and it rides on
the Track: the reveal screen receives a Track and nothing else, and a
parallel pipe for data that has to arrive there anyway would only be one
more thing to keep in sync.

Optional and almost always absent — only playlists that ship a series
map fill it in, and a track the map says nothing about stays blank
rather than being guessed at.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The round builder, answering with a series

Pure logic, no registration yet. The mode exists as a module and is fully tested before anything can select it.

**Files:**
- Create: `src/shared/modes/anime.ts`
- Modify: `src/shared/modes/index.ts:6-19` (`RoundPlan`)
- Modify: `src/shared/modes/rounds.ts:140-148` (set the new field)
- Modify: `src/shared/modes/quiz.ts`, `src/shared/modes/heardle.ts` (no change needed if they go through `buildChoiceRounds` — verify)
- Modify: `src/server/rooms.ts:746`
- Test: `tests/anime.test.ts` (create)

**Interfaces:**
- Consumes: `Track.series` from Task 1
- Produces: `animeMode: GameMode`, `SERIES_CHOICE_COUNT = 4`, both exported from `src/shared/modes/anime.ts`; `RoundPlan.correctChoiceId: string`

- [ ] **Step 1: Write the failing test**

Create `tests/anime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { animeMode, SERIES_CHOICE_COUNT } from "@/shared/modes/anime";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import type { Track } from "@/shared/types";

/** `shows` series, `per` songs each, one series per decade so eras are distinct. */
function pool(shows: number, per: number): Track[] {
  const out: Track[] = [];
  for (let s = 0; s < shows; s++) {
    for (let n = 0; n < per; n++) {
      out.push({
        id: `${s}-${n}`,
        title: `Opening ${s}-${n}`,
        artist: `Artist ${s}`,
        artistId: s,
        artworkUrl: "https://example.test/art.jpg",
        previewUrl: `https://example.test/${s}-${n}.m4a`,
        year: 2000 + s,
        series: `Show ${s}`,
      });
    }
  }
  return out;
}

const build = (
  difficulty: keyof typeof DIFFICULTIES,
  tracks: Track[],
  count = 10,
  exclude?: Set<string>,
) =>
  animeMode.buildRounds({
    pool: tracks,
    count,
    difficulty: DIFFICULTIES[difficulty],
    rng: makeRng(4321),
    exclude,
  });

describe("anime rounds", () => {
  it("offers four distinct shows, one of them the answer's", () => {
    for (const rounds of [build("easy", pool(12, 3)), build("extreme", pool(12, 3))]) {
      expect(rounds).toHaveLength(10);
      for (const r of rounds) {
        expect(r.choices).toHaveLength(SERIES_CHOICE_COUNT);
        expect(new Set(r.choices.map((c) => c.id)).size).toBe(SERIES_CHOICE_COUNT);
        expect(r.choices.filter((c) => c.id === r.answer.series)).toHaveLength(1);
      }
    }
  });

  it("names the show, not the song, on every tile", () => {
    for (const r of build("medium", pool(12, 3))) {
      for (const c of r.choices) {
        expect(c.title).toMatch(/^Show \d+$/);
        expect(c.id).toBe(c.title);
      }
    }
  });

  // A show with six openings would otherwise be the answer six times.
  it("never uses the same show as the answer twice in one match", () => {
    const rounds = build("medium", pool(12, 5));
    const shows = rounds.map((r) => r.answer.series);
    expect(new Set(shows).size).toBe(shows.length);
  });

  it("ignores tracks with no series at all", () => {
    const mixed = [
      ...pool(6, 2),
      { ...pool(1, 1)[0]!, id: "plain", series: undefined },
    ];
    for (const r of build("easy", mixed, 5)) {
      expect(r.answer.series).toBeTruthy();
      expect(r.choices.map((c) => c.id)).not.toContain(undefined);
    }
  });

  // Fewer than four shows cannot fill the grid, and a lopsided round is worse
  // than a missing one — the same call rounds.ts makes about decoys.
  it("builds nothing from a pool of fewer than four shows", () => {
    expect(build("medium", pool(3, 8))).toHaveLength(0);
  });

  it("keeps the hard decoys inside the answer's era", () => {
    // Two clusters twenty years apart; only the near ones may be decoys.
    const near = pool(6, 2);
    const far = pool(6, 2).map((t) => ({
      ...t,
      id: `far-${t.id}`,
      series: `Far ${t.series}`,
      year: t.year + 40,
    }));
    for (const r of build("extreme", [...near, ...far], 6)) {
      for (const c of r.choices) {
        const isFar = c.id.startsWith("Far ");
        expect(isFar).toBe(r.answer.series!.startsWith("Far "));
      }
    }
  });

  it("scores a right show and rejects a wrong one", () => {
    const [round] = build("medium", pool(12, 3), 1);
    const spec = DIFFICULTIES.medium;

    const right = animeMode.judge({
      plan: round!,
      guess: round!.answer.series!,
      elapsedMs: 1_000,
      level: 0,
    });
    expect(right.correct).toBe(true);
    expect(right.gained).toBeGreaterThan(0);
    expect(right.final).toBe(true);

    const wrong = animeMode.judge({
      plan: round!,
      guess: "Some Other Show",
      elapsedMs: 1_000,
      level: 0,
    });
    expect(wrong.correct).toBe(false);
    expect(wrong.gained).toBe(0);
    expect(wrong.final).toBe(true);

    // A song title must never be accepted — the question is the show.
    expect(
      animeMode.judge({ plan: round!, guess: round!.answer.title, elapsedMs: 1_000, level: 0 })
        .correct,
    ).toBe(false);

    expect(round!.clipMs).toBe(spec.clipMs);
    expect(round!.answerWindowMs).toBe(spec.answerWindowMs);
    expect(round!.stagesMs).toEqual([]);
  });

  it("names the winning tile on the plan", () => {
    for (const r of build("medium", pool(12, 3))) {
      expect(r.correctChoiceId).toBe(r.answer.series);
      expect(r.choices.some((c) => c.id === r.correctChoiceId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/anime.test.ts`
Expected: FAIL — `Cannot find module '@/shared/modes/anime'`.

- [ ] **Step 3: Teach `RoundPlan` to name its winning tile**

`correctChoiceId` is currently derived in `rooms.ts` as `plan.answer.id`, which is only true while the tiles are songs. The mode builds the choices, so the mode is what knows.

In `src/shared/modes/index.ts`, add to `RoundPlan` after `choices`:

```ts
  /**
   * Which `choices` entry is the right one. Not always the answer's track id:
   * an anime round's tiles are shows, so the winning tile is named by the
   * series. The mode builds the choices, so the mode is what can say.
   */
  correctChoiceId: string;
```

In `src/shared/modes/rounds.ts`, inside the `rounds.push({...})` call in `buildChoiceRounds`, after `answer`:

```ts
      correctChoiceId: answer.id,
```

In `src/server/rooms.ts:746`, replace `correctChoiceId: plan.answer.id,` with:

```ts
      correctChoiceId: plan.correctChoiceId,
```

- [ ] **Step 4: Write the mode**

Create `src/shared/modes/anime.ts`:

```ts
import { scoreAnswer } from "../scoring";
import { shuffle, type Rng } from "../rng";
import type { Choice, Track } from "../types";
import type { BuildRoundsInput, GameMode, Judgement, JudgeInput, RoundPlan } from "./index";

/** Four, like every other mode: the 2x2 grid is the shape of the whole UI. */
export const SERIES_CHOICE_COUNT = 4;

/** Within this many years, two shows count as the same era. */
const SAME_ERA_YEARS = 2;

type SeriesTrack = Track & { series: string };

const hasSeries = (t: Track): t is SeriesTrack => Boolean(t.series);

const toChoice = (series: string): Choice => ({ id: series, title: series });

/**
 * The year a show is represented by: the earliest release among its tracks. A
 * second opening released five years later should not drag the show forward
 * into an era it does not belong to.
 */
function yearsBySeries(tracks: readonly SeriesTrack[]): Map<string, number> {
  const years = new Map<string, number>();
  for (const t of tracks) {
    const known = years.get(t.series);
    if (known === undefined || (t.year > 0 && t.year < known)) years.set(t.series, t.year);
  }
  return years;
}

/**
 * Three wrong shows.
 *
 * `tight` prefers shows from the answer's own era, which is what stops the
 * decade being a free elimination on the harder levels. It is a preference,
 * not a guarantee: a pool with nothing nearby falls back to whatever is left
 * rather than dropping the round.
 */
function pickDecoySeries(
  answer: SeriesTrack,
  years: ReadonlyMap<string, number>,
  tight: boolean,
  rng: Rng,
): string[] {
  const others = [...years.keys()].filter((s) => s !== answer.series);
  if (!tight) return shuffle(others, rng).slice(0, SERIES_CHOICE_COUNT - 1);

  const near = others.filter(
    (s) => Math.abs((years.get(s) ?? 0) - answer.year) <= SAME_ERA_YEARS,
  );
  const nearSet = new Set(near);
  return [
    ...shuffle(near, rng),
    ...shuffle(others.filter((s) => !nearSet.has(s)), rng),
  ].slice(0, SERIES_CHOICE_COUNT - 1);
}

/**
 * One clip, four shows, name the one it opens.
 *
 * The first mode whose answer is not the thing being played, which is why it
 * sits beside `buildChoiceRounds` instead of calling it: sharing a builder
 * between "four songs" and "four shows" would take a strategy and a key
 * extractor and satisfy neither caller.
 */
export const animeMode: GameMode = {
  id: "anime",
  shared: false,
  typed: false,
  requiresSeries: true,

  buildRounds({ pool, count, difficulty, rng, exclude }: BuildRoundsInput): RoundPlan[] {
    const tracks = pool.filter(hasSeries);
    const years = yearsBySeries(tracks);
    // Fewer than four shows cannot fill the grid at all, whatever the pool
    // holds in songs.
    if (years.size < SERIES_CHOICE_COUNT) return [];

    const fresh = exclude ? tracks.filter((t) => !exclude.has(t.id)) : tracks;
    const answerPool = shuffle(fresh.length >= count ? fresh : tracks, rng);
    // easy and medium ask for `different-artist`; hard and extreme do not.
    const tight = difficulty.decoy !== "different-artist";

    const rounds: RoundPlan[] = [];
    const usedSeries = new Set<string>();

    for (const answer of answerPool) {
      if (rounds.length >= count) break;
      // A show with six openings is fine in the pool and would be tedious as
      // six answers. It earns one, and turns up as a decoy the rest of the time
      // — which is the right bias: a familiar wrong tile is what makes a guess
      // a guess.
      if (usedSeries.has(answer.series)) continue;

      const decoys = pickDecoySeries(answer, years, tight, rng);
      if (decoys.length < SERIES_CHOICE_COUNT - 1) continue;

      usedSeries.add(answer.series);
      rounds.push({
        index: rounds.length,
        answer,
        choices: shuffle([answer.series, ...decoys].map(toChoice), rng),
        correctChoiceId: answer.series,
        clipMs: difficulty.clipMs,
        answerWindowMs: difficulty.answerWindowMs,
        // No ladder here; the clip is what it is, exactly as in Quiz.
        stagesMs: [],
        multiplier: difficulty.multiplier,
      });
    }

    return rounds;
  },

  judge({ plan, guess, elapsedMs }: JudgeInput): Judgement {
    // `guess` is a trimmed non-empty string by the time it reaches here, so an
    // answer with no series can never accidentally match.
    const correct = guess === plan.answer.series;
    return {
      correct,
      gained: scoreAnswer({
        correct,
        elapsedMs,
        windowMs: plan.answerWindowMs,
        multiplier: plan.multiplier,
      }),
      final: true,
      level: 0,
    };
  },
};
```

- [ ] **Step 5: Add `requiresSeries` to the `GameMode` interface**

In `src/shared/modes/index.ts`, add to the `GameMode` type after `typed`:

```ts
  /**
   * True when the mode asks about something only a series-bearing Playlist
   * can answer. Naming the requirement rather than a Playlist group is what
   * lets a second anime Playlist become selectable by carrying the data,
   * with nothing here to update.
   */
  requiresSeries: boolean;
```

Then set `requiresSeries: false` on `quizMode` (`src/shared/modes/quiz.ts`) and on both `heardleMode` and `heardleCoopMode` (`src/shared/modes/heardle.ts`).

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/anime.test.ts && npm test`
Expected: PASS. `tests/quiz.test.ts` and `tests/heardle.test.ts` still pass — `correctChoiceId` is additive.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modes/anime.ts src/shared/modes/index.ts src/shared/modes/rounds.ts src/shared/modes/quiz.ts src/shared/modes/heardle.ts src/server/rooms.ts tests/anime.test.ts
git commit -m "$(cat <<'EOF'
Add a round builder whose four tiles are shows

The first mode whose answer is not the thing being played. It sits
beside buildChoiceRounds rather than calling it: a builder shared
between "four songs" and "four shows" would take a strategy and a key
extractor and satisfy neither caller.

A show earns one answer per match however many openings it has, and
turns up as a decoy the rest of the time — a familiar wrong tile is what
makes a guess a guess. On hard and extreme the decoys stay inside the
answer's era, so the decade stops being a free elimination.

correctChoiceId moves onto the RoundPlan on the way past. It was derived
in rooms.ts as the answer's track id, which is only true while the tiles
are songs; the mode builds the choices, so the mode is what knows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Register the mode on the wire

The mode becomes a real `GameModeId` the server accepts. Deliberately **not** added to `MODE_ORDER` yet — that is Task 7's job, and until then the mode is reachable only through a hand-crafted payload, which the Task 4 guard will reject anyway.

**Files:**
- Modify: `src/shared/types.ts:47-56` (`GameModeId`)
- Modify: `src/shared/protocol.ts:52` (`modeSchema`)
- Modify: `src/shared/modes/index.ts:87-91` (`MODES`)
- Modify: `src/client/i18n.ts` (mode copy)
- Test: `tests/modes.test.ts` (create)

**Interfaces:**
- Consumes: `animeMode` from Task 2
- Produces: `GameModeId` includes `"anime"`; `MODES.anime === animeMode`; i18n keys `mode.anime`, `mode.anime.hint`

- [ ] **Step 1: Write the failing test**

Create `tests/modes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MODES, MODE_ORDER, DEFAULT_MODE } from "@/shared/modes";
import { modeSchema } from "@/shared/protocol";
import { STRINGS } from "@/client/i18n";
import type { GameModeId } from "@/shared/types";

const ALL = Object.keys(MODES) as GameModeId[];

describe("mode registry", () => {
  // The wire schema is what actually guards the server; a mode in MODES but
  // not in the enum would be unselectable, and the reverse would be unplayable.
  it("accepts exactly the registered modes over the wire", () => {
    for (const id of ALL) expect(modeSchema.safeParse(id).success).toBe(true);
    expect(modeSchema.safeParse("anime-coop").success).toBe(false);
    expect(modeSchema.safeParse("quizz").success).toBe(false);
  });

  it("keys every mode by its own id", () => {
    for (const id of ALL) expect(MODES[id].id).toBe(id);
  });

  it("has copy in both languages for every mode", () => {
    for (const id of ALL) {
      const name = STRINGS[`mode.${id}` as keyof typeof STRINGS];
      expect(name, `missing copy for ${id}`).toBeDefined();
      expect(name.th.length).toBeGreaterThan(0);
      expect(name.en.length).toBeGreaterThan(0);
    }
  });

  it("orders only modes that exist, and defaults to one of them", () => {
    for (const id of MODE_ORDER) expect(MODES[id]).toBeDefined();
    expect(MODES[DEFAULT_MODE]).toBeDefined();
    expect(MODES[DEFAULT_MODE].requiresSeries).toBe(false);
  });

  it("marks anime as the only mode that needs series data", () => {
    expect(MODES.anime.requiresSeries).toBe(true);
    for (const id of ALL) {
      if (id !== "anime") expect(MODES[id].requiresSeries).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modes.test.ts`
Expected: FAIL — `Property 'anime' does not exist` on `MODES`.

- [ ] **Step 3: Extend the id union**

In `src/shared/types.ts`, replace the `GameModeId` type and its doc comment:

```ts
/**
 * The Game Modes a Room can play.
 *
 * `quiz` is one clip and one answer chosen off the screen. Both Heardle modes
 * replace that with a clip you unlock a step at a time and an answer you type.
 * The split between them is social, not mechanical: `heardle` gives every
 * player their own ladder and score, `heardle-coop` gives the whole Room one of
 * each.
 *
 * `anime` is the one that changes the question rather than the delivery: the
 * tiles are shows, not songs, and it is playable only against a Playlist that
 * ships the mapping.
 */
export type GameModeId = "quiz" | "heardle" | "heardle-coop" | "anime";
```

- [ ] **Step 4: Extend the wire enum and the registry**

In `src/shared/protocol.ts:52`:

```ts
export const modeSchema = z.enum(["quiz", "heardle", "heardle-coop", "anime"]);
```

In `src/shared/modes/index.ts`, add the export, the import and the registry entry:

```ts
export { animeMode, SERIES_CHOICE_COUNT } from "./anime";
```

```ts
import { animeMode } from "./anime";
```

```ts
export const MODES: Record<GameModeId, GameMode> = {
  quiz: quizMode,
  heardle: heardleMode,
  "heardle-coop": heardleCoopMode,
  anime: animeMode,
};
```

- [ ] **Step 5: Add the copy**

In `src/client/i18n.ts`, beside the other `mode.*` entries:

```ts
  "mode.anime": { th: "ทายอนิเมะ", en: "Guess the anime" },
  "mode.anime.hint": {
    th: "ได้ยินเพลงเปิด แล้วตอบว่ามาจากเรื่องไหน",
    en: "Hear the opening, name the show it belongs to",
  },
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/modes.test.ts && npm test && npm run build`
Expected: PASS. `npm run build` proves nothing switches exhaustively on `GameModeId` without a case for `anime`; fix any that do.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/protocol.ts src/shared/modes/index.ts src/client/i18n.ts tests/modes.test.ts
git commit -m "$(cat <<'EOF'
Register anime as a mode the server will accept

The TypeScript union and the Zod enum are two sources of truth that do
not check each other, so the new test asserts they agree — a mode in one
and not the other is either unselectable or unplayable.

Deliberately not in MODE_ORDER yet: nothing should be able to select a
mode whose only playable playlist has not shipped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The coupling, enforced where it counts

Hiding a tile is a courtesy to the host. A socket payload is attacker-controlled input, so the check that matters is the server's.

**Files:**
- Create: `src/shared/match-config.ts`
- Modify: `src/server/rooms.ts:376-384` (`setConfig`)
- Test: `tests/match-config.test.ts` (create)

**Interfaces:**
- Consumes: `MODES` and `requiresSeries` from Tasks 2-3; `PLAYLISTS` from `@/data/seeds`
- Produces: `sourceSuitsMode(mode: GameModeId, source: SongSource): boolean`, `seriesPlaylistIds(): PlaylistId[]`, `defaultSourceForMode(mode: GameModeId, current: SongSource): SongSource` — all from `src/shared/match-config.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/match-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultSourceForMode,
  seriesPlaylistIds,
  sourceSuitsMode,
} from "@/shared/match-config";
import type { SongSource } from "@/shared/types";

const playlist = (id: string): SongSource =>
  ({ kind: "playlist", playlist: id }) as SongSource;
const artist: SongSource = { kind: "artist", artist: "Bodyslam" };

describe("mode and source compatibility", () => {
  it("lets every ordinary mode play anything", () => {
    for (const mode of ["quiz", "heardle", "heardle-coop"] as const) {
      expect(sourceSuitsMode(mode, playlist("thai-classic"))).toBe(true);
      expect(sourceSuitsMode(mode, artist)).toBe(true);
    }
  });

  it("refuses anime mode against a playlist with no shows in it", () => {
    expect(sourceSuitsMode("anime", playlist("thai-classic"))).toBe(false);
  });

  // An artist pool is built from one act's catalogue and carries no series at
  // all, so it can never satisfy the mode however the artist is chosen.
  it("refuses anime mode against any artist", () => {
    expect(sourceSuitsMode("anime", artist)).toBe(false);
  });

  it("accepts anime mode against every playlist that ships the mapping", () => {
    for (const id of seriesPlaylistIds()) {
      expect(sourceSuitsMode("anime", playlist(id))).toBe(true);
    }
  });

  it("leaves a source alone when the mode can already play it", () => {
    const current = playlist("thai-classic");
    expect(defaultSourceForMode("quiz", current)).toBe(current);
  });

  // This task lands before the anime playlist does, so both branches are
  // written now and the assertion follows whichever is currently true. Once
  // Task 6 ships `anime-all` the first branch is the live one, and it keeps
  // asserting the same thing.
  it("swaps in a workable source when one exists, and does not invent one", () => {
    const fixed = defaultSourceForMode("anime", playlist("thai-classic"));

    if (seriesPlaylistIds().length > 0) {
      expect(sourceSuitsMode("anime", fixed)).toBe(true);
      expect(defaultSourceForMode("anime", fixed)).toBe(fixed);
    } else {
      expect(fixed).toEqual(playlist("thai-classic"));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match-config.test.ts`
Expected: FAIL — `Cannot find module '@/shared/match-config'`.

- [ ] **Step 3: Write the module**

Create `src/shared/match-config.ts`:

```ts
import type { GameModeId, PlaylistId, SongSource } from "./types";
import { MODES } from "./modes";
import { PLAYLISTS, PLAYLIST_IDS } from "@/data/seeds";

/**
 * Mode and Song Source were independent until the anime mode, and this module
 * is the whole of what changed. Everything that needs the rule — the picker,
 * the lobby, and the guard in `setConfig` — reads it from here, so there is
 * one answer rather than three that drift.
 */

/** Playlists that name the show each of their songs is from. */
export function seriesPlaylistIds(): PlaylistId[] {
  return PLAYLIST_IDS.filter((id) => {
    const { source } = PLAYLISTS[id];
    return source.kind === "tracks" && source.series !== undefined;
  });
}

export function sourceSuitsMode(mode: GameModeId, source: SongSource): boolean {
  if (!MODES[mode].requiresSeries) return true;
  // An artist pool is one act's catalogue straight from iTunes; there is
  // nowhere for a series to have come from.
  if (source.kind !== "playlist") return false;
  const def = PLAYLISTS[source.playlist].source;
  return def.kind === "tracks" && def.series !== undefined;
}

/**
 * The source to use when switching to `mode`.
 *
 * Returns `current` untouched whenever it already works, so switching away
 * from anime mode keeps the anime playlist — it is a perfectly good pool for
 * "which song is this?".
 */
export function defaultSourceForMode(
  mode: GameModeId,
  current: SongSource,
): SongSource {
  if (sourceSuitsMode(mode, current)) return current;
  const first = seriesPlaylistIds()[0];
  // No series playlist has shipped: leave the source alone and let the server
  // guard refuse the config, rather than inventing one that does not exist.
  if (!first) return current;
  return { kind: "playlist", playlist: first };
}
```

- [ ] **Step 4: Guard the server**

In `src/server/rooms.ts`, add the import beside the other shared imports:

```ts
import { sourceSuitsMode } from "@/shared/match-config";
```

and replace the body of `setConfig` after the phase check:

```ts
    if (!sourceSuitsMode(config.mode, config.source)) {
      // The picker hides the pairing, but a socket payload is not the picker.
      throw new RoomError("bad_config", "โหมดนี้เล่นกับเพลย์ลิสต์นี้ไม่ได้");
    }
    room.config = config;
```

- [ ] **Step 5: Cover the guard**

The guard lives in `RoomStore`, so its test belongs in `tests/rooms.test.ts` beside the other `setConfig` cases. Read that file first and reuse whatever helper it already has for standing up a room with a host — do not introduce a second one. The case, with the helper's names substituted in:

```ts
  it("refuses a mode and source the picker would never have offered", () => {
    const { store, room, hostId } = makeRoom();
    expect(() =>
      store.setConfig(room, hostId, {
        mode: "anime",
        source: { kind: "playlist", playlist: "thai-classic" },
        difficulty: "medium",
        roundCount: 10,
      }),
    ).toThrow(RoomError);
  });

  it("still accepts a mode and source that belong together", () => {
    const { store, room, hostId } = makeRoom();
    expect(() =>
      store.setConfig(room, hostId, {
        mode: "quiz",
        source: { kind: "playlist", playlist: "thai-classic" },
        difficulty: "medium",
        roundCount: 10,
      }),
    ).not.toThrow();
  });
```

Note that Task 4 runs before the anime playlist ships (Task 6), so `sourceSuitsMode("anime", ...)` is false for every source at this point — which is exactly what the first case asserts, and it keeps asserting the right thing once `anime-all` exists.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/match-config.test.ts tests/rooms.test.ts && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/match-config.ts src/server/rooms.ts tests/match-config.test.ts tests/rooms.test.ts
git commit -m "$(cat <<'EOF'
Refuse a mode and source that cannot play together

Mode and Song Source were independent until the anime mode, and this
module is the whole of what changed — the picker, the lobby and the
server guard all read the rule from one place rather than three that
drift.

The guard lives in setConfig because hiding a tile is a courtesy to the
host and a socket payload is not the picker.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Draft the song list

**This task has a human gate in the middle.** The script writes a CSV; the CSV gets reviewed before it becomes a seed. A show nobody in the room has watched is a dead round, and that judgement is not the script's to make.

**Files:**
- Create: `scripts/draft-anime-playlist.ts`
- Create: `src/data/seeds/anime-source.csv` (script output, then hand-edited)

**Interfaces:**
- Consumes: `getArtistTracksById`, `artistIdFor` from `src/server/itunes.ts`
- Produces: `src/data/seeds/anime-source.csv` with columns `series,song,artist,trackId,itunesTitle`

- [ ] **Step 1: Agree the artist shortlist**

Before writing any code, propose the shortlist to the user and get it confirmed. It is the one input that decides whether the playlist is fun. Starting proposal, all acts whose anime work is the work people recognise:

`YOASOBI`, `LiSA`, `Aimer`, `Kenshi Yonezu`, `RADWIMPS`, `Yorushika`, `Eve`, `Ado`, `Official HIGE DANdism`, `King Gnu`, `Vaundy`, `Hiroyuki Sawano`, `ReoNa`, `Fujii Kaze`, `Tatsuya Kitani`, `Creepy Nuts`, `Zutomayo`, `SPYAIR`, `UVERworld`, `ONE OK ROCK`, `FLOW`, `Asian Kung-Fu Generation`, `Kana-Boon`, `Yuuri`, `milet`

Do not proceed to Step 2 until the user has confirmed, added to, or cut from this list.

- [ ] **Step 2: Write the script**

Create `scripts/draft-anime-playlist.ts`:

```ts
/**
 * Draft an anime playlist for review.
 *
 * AnimeThemes.moe knows which show every opening belongs to, but writes song
 * titles in romaji where the storefront writes them in Japanese — matching the
 * two catalogues by title alone scored 41/148 on a sample. So this goes
 * artist-first over a shortlist: pull the act's whole iTunes catalogue through
 * the id lookup, pull the same act's themes from AnimeThemes, and match within
 * that much smaller set.
 *
 * The output is a CSV for a human to read, not a seed. Every row the match
 * missed is written out too, so the review can see what was lost.
 *
 * Run: NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/draft-anime-playlist.ts
 */
import { writeFileSync } from "node:fs";
import { artistIdFor, getArtistTracksById } from "@/server/itunes";

/** Agreed in Step 1. Edit here, not at the call site. */
const SHORTLIST: string[] = [
  // filled in from the confirmed shortlist
];

const THEMES_URL = "https://api.animethemes.moe/anime";
const OUT = "src/data/seeds/anime-source.csv";

/** AnimeThemes sits behind a CDN that answers a bare fetch with 403. */
const HEADERS = { Accept: "application/json", "User-Agent": "guess-music/0.1" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Loose enough for punctuation and case, strict enough not to merge songs. */
const norm = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

type Theme = { series: string; song: string; artist: string };

async function allThemes(): Promise<Theme[]> {
  const out: Theme[] = [];
  let url: string | null =
    `${THEMES_URL}?${new URLSearchParams({
      "filter[has]": "animethemes",
      include: "animethemes.song.artists",
      "page[size]": "100",
    })}`;

  while (url) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`animethemes ${res.status}`);
    const body = (await res.json()) as {
      anime?: Array<{
        name?: string;
        animethemes?: Array<{
          song?: { title?: string; artists?: Array<{ name?: string }> };
        }>;
      }>;
      links?: { next?: string | null };
    };
    for (const a of body.anime ?? []) {
      for (const th of a.animethemes ?? []) {
        const song = th.song?.title;
        const artist = th.song?.artists?.[0]?.name;
        if (a.name && song && artist) out.push({ series: a.name, song, artist });
      }
    }
    url = body.links?.next ?? null;
    await sleep(300);
  }
  return out;
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function main() {
  console.log("fetching AnimeThemes...");
  const themes = await allThemes();
  console.log(`  ${themes.length} themes`);

  const rows: string[] = ["series,song,artist,trackId,itunesTitle"];
  let matched = 0;
  let missed = 0;

  for (const name of SHORTLIST) {
    const id = artistIdFor(name);
    // The id map is the endpoint that does not throttle into 403s (ADR 0005);
    // an act missing from it needs adding there before it can be drafted.
    if (id === undefined) {
      console.log(`${name}: no artist id — add it to src/data/seeds/artist-ids.ts`);
      continue;
    }

    const tracks = await getArtistTracksById(id, "TH");
    const byTitle = new Map(tracks.map((t) => [norm(t.title), t]));
    const mine = themes.filter((t) => norm(t.artist) === norm(name));

    let hit = 0;
    for (const th of mine) {
      const track = byTitle.get(norm(th.song));
      if (track) hit++;
      else missed++;
      rows.push(
        [
          csvCell(th.series),
          csvCell(th.song),
          csvCell(name),
          csvCell(track?.id ?? ""),
          csvCell(track?.title ?? ""),
        ].join(","),
      );
    }
    matched += hit;
    console.log(`${name}: itunes=${tracks.length} themes=${mine.length} matched=${hit}`);
    await sleep(1_000);
  }

  writeFileSync(OUT, rows.join("\n") + "\n");
  console.log(`\nwrote ${OUT}: ${matched} matched, ${missed} missed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Run it**

```bash
NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/draft-anime-playlist.ts
```

Expected: a per-artist match count and `src/data/seeds/anime-source.csv`. The iTunes side uses only the id-lookup endpoint (one request per artist, no throttling), and AnimeThemes is paced at 300ms — nothing here risks a 403 storm.

If an artist prints `no artist id`, resolve it with `npx tsx scripts/resolve-artist-ids.ts` and add the id to `src/data/seeds/artist-ids.ts` before re-running.

- [ ] **Step 4: HUMAN GATE — review the CSV**

Hand the CSV to the user. They cut rows for shows the room would not know, cut rows where `trackId` is blank, and fix any series name that reads badly. Do not proceed until they hand it back.

The reviewed file needs at minimum **four distinct series** to build a round at all, and realistically **twenty or more** for a ten-round match that does not repeat itself.

- [ ] **Step 5: Commit script and reviewed CSV**

```bash
git add scripts/draft-anime-playlist.ts src/data/seeds/anime-source.csv
git commit -m "$(cat <<'EOF'
Draft an anime playlist from AnimeThemes, for review

AnimeThemes knows which show every opening belongs to but writes titles
in romaji where the storefront writes Japanese — matching the catalogues
by title alone scored 41/148 on a sample. So this goes artist-first over
an agreed shortlist and matches inside one act's catalogue, through the
id lookup that does not throttle.

The output is a CSV for a human to read, not a seed. A show nobody in
the room has watched is a dead round, and that is not the script's call.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Ship the playlist

**Files:**
- Create: `src/data/seeds/anime.ts`
- Modify: `src/shared/types.ts` (`PlaylistId`, `PlaylistGroup`)
- Modify: `src/shared/protocol.ts:35-50` (`playlistSchema`)
- Modify: `src/data/seeds/index.ts` (`PLAYLISTS`, `PLAYLIST_GROUPS`)
- Modify: `src/client/i18n.ts` (playlist and group copy)
- Modify: `src/client/components/PlaylistPicker.tsx:10-14` (`GROUP_LABEL`)
- Test: `tests/anime-seed.test.ts` (extend)

**Interfaces:**
- Consumes: the reviewed CSV from Task 5
- Produces: `ANIME_TRACKS: ReadonlyArray<{ id: string; series: string }>`, `ANIME_TRACK_IDS`, `ANIME_SERIES` from `src/data/seeds/anime.ts`; playlist id `"anime-all"`; group `"anime"`

- [ ] **Step 1: Write the failing test**

Append to `tests/anime-seed.test.ts`:

```ts
import { ANIME_TRACKS, ANIME_TRACK_IDS, ANIME_SERIES } from "@/data/seeds/anime";
import { PLAYLISTS } from "@/data/seeds";
import { SERIES_CHOICE_COUNT } from "@/shared/modes/anime";

describe("the anime seed", () => {
  it("names a show for every track, and no id twice", () => {
    expect(ANIME_TRACKS.length).toBeGreaterThan(0);
    expect(new Set(ANIME_TRACK_IDS).size).toBe(ANIME_TRACK_IDS.length);
    for (const { id, series } of ANIME_TRACKS) {
      expect(id).toMatch(/^\d+$/);
      expect(series.length).toBeGreaterThan(0);
      expect(ANIME_SERIES[id]).toBe(series);
    }
  });

  // Below four shows the mode cannot fill a grid; twenty is what a ten-round
  // match needs before it starts repeating itself.
  it("holds enough distinct shows to play a full match", () => {
    const shows = new Set(ANIME_TRACKS.map((t) => t.series));
    expect(shows.size).toBeGreaterThanOrEqual(SERIES_CHOICE_COUNT);
    expect(shows.size).toBeGreaterThanOrEqual(20);
  });

  it("wires the seed into the playlist that uses it", () => {
    const { source, group } = PLAYLISTS["anime-all"];
    expect(group).toBe("anime");
    expect(source.kind).toBe("tracks");
    if (source.kind !== "tracks") throw new Error("unreachable");
    expect(source.trackIds).toEqual(ANIME_TRACK_IDS);
    expect(source.series).toEqual(ANIME_SERIES);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/anime-seed.test.ts`
Expected: FAIL — `Cannot find module '@/data/seeds/anime'`.

- [ ] **Step 3: Generate the seed from the reviewed CSV**

Write a one-off conversion inline (do not add a script for it — `resolve-csv-playlist.ts` resolves titles to ids, which this CSV already has). Read `src/data/seeds/anime-source.csv`, drop rows with a blank `trackId`, and emit `src/data/seeds/anime.ts` shaped like:

```ts
/**
 * Anime openings and endings, by iTunes track id and the show each is from.
 *
 * Drafted by scripts/draft-anime-playlist.ts out of AnimeThemes.moe and the
 * iTunes catalogue, then cut by hand — see src/data/seeds/anime-source.csv for
 * everything that was considered, including the rows that found no match.
 *
 * The series names are romaji, which is what AnimeThemes provides and what the
 * review pass read.
 */
export const ANIME_TRACKS: ReadonlyArray<{ id: string; series: string }> = [
  { id: "1571263259", series: "Yozakura" },
  // ...
];

export const ANIME_TRACK_IDS: readonly string[] = ANIME_TRACKS.map((t) => t.id);

export const ANIME_SERIES: Readonly<Record<string, string>> = Object.fromEntries(
  ANIME_TRACKS.map((t) => [t.id, t.series]),
);
```

- [ ] **Step 4: Register the playlist**

In `src/shared/types.ts`, add `| "anime-all"` to `PlaylistId` and `| "anime"` to `PlaylistGroup`.

In `src/shared/protocol.ts`, add `"anime-all",` to `playlistSchema`'s enum.

In `src/data/seeds/index.ts`, add the import and the entry:

```ts
import { ANIME_SERIES, ANIME_TRACK_IDS } from "./anime";
```

```ts
  "anime-all": {
    id: "anime-all",
    group: "anime",
    // The only playlist that names what each song is from, which is what makes
    // the anime mode playable — see src/data/seeds/anime.ts.
    source: {
      kind: "tracks",
      country: "TH",
      trackIds: ANIME_TRACK_IDS,
      series: ANIME_SERIES,
    },
  },
```

and add the group to `PLAYLIST_GROUPS`, after `intl`:

```ts
  { group: "anime", ids: ["anime-all"] },
```

- [ ] **Step 5: Add the copy**

In `src/client/i18n.ts`:

```ts
  groupAnime: { th: "อนิเมะ", en: "Anime" },
```

```ts
  "playlist.anime-all": { th: "เพลงอนิเมะ", en: "Anime — openings & endings" },
```

In `src/client/components/PlaylistPicker.tsx`, add to `GROUP_LABEL`:

```ts
  anime: "groupAnime",
```

- [ ] **Step 6: Run the tests**

Run: `npm test && npm run build`
Expected: PASS, including `tests/playlists.test.ts`, which independently checks that every registered playlist is in the schema and has copy in both languages.

- [ ] **Step 7: Verify against the live catalogue**

The unit tests prove the wiring; only iTunes proves the ids still resolve. Run a throwaway check that `buildPool` returns a real pool and `animeMode.buildRounds` fills ten rounds from it at `extreme`, and report the pool size, distinct-series count and year span. Delete the throwaway afterwards.

- [ ] **Step 8: Commit**

```bash
git add src/data/seeds/anime.ts src/data/seeds/index.ts src/shared/types.ts src/shared/protocol.ts src/client/i18n.ts src/client/components/PlaylistPicker.tsx tests/anime-seed.test.ts
git commit -m "$(cat <<'EOF'
Ship the anime playlist and the group it sits in

The first playlist that names what each song is from, which is the whole
of what makes the anime mode playable. Series names are romaji — what
AnimeThemes provides and what the review pass read.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Make it selectable

**Files:**
- Modify: `src/shared/modes/index.ts:102` (`MODE_ORDER`)
- Modify: `src/client/components/ModePicker.tsx`
- Modify: `src/client/components/PlaylistPicker.tsx`
- Modify: `src/client/components/LobbyScreen.tsx:187-201`

**Interfaces:**
- Consumes: `sourceSuitsMode`, `defaultSourceForMode` from Task 4; the `anime-all` playlist from Task 6
- Produces: nothing further tasks depend on

- [ ] **Step 1: Order the mode into the picker**

In `src/shared/modes/index.ts`, update `MODE_ORDER` and its comment:

```ts
/**
 * The order the picker lays them out in: familiar first, then the twists.
 *
 * `heardle-coop` is not in here — it is a `GameModeId` a Room can genuinely
 * run, but not a card of its own in `ModePicker`, which folds it into the
 * "Heardle" card as a second choice instead of a third parallel one. Anything
 * that needs to enumerate every actual mode should read `MODES`, not this.
 */
export const MODE_ORDER: GameModeId[] = ["quiz", "heardle", "anime"];
```

- [ ] **Step 2: Generalise the plain card**

`QuizCard` hardcodes `t("mode.quiz")`, so a third plain card cannot reuse it. In `src/client/components/ModePicker.tsx`, rename it `PlainCard` and take the id:

```tsx
function PlainCard({
  id,
  index,
  active,
  disabled,
  onSelect,
}: {
  id: GameModeId;
  index: number;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t } = useLang();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={`flex min-h-44 flex-col p-4 text-left transition-colors ${
        active
          ? "bg-ink text-paper"
          : disabled
            ? "cursor-not-allowed bg-paper text-grey-500"
            : "bg-paper text-ink hover:bg-grey-100"
      }`}
    >
      <span className="numeric label">{String(index + 1).padStart(2, "0")}</span>
      <span className="mt-3 font-semibold" style={{ fontSize: "var(--text-body)" }}>
        {t(`mode.${id}` as StringKey)}
      </span>

      <ClipShape stages={0} />

      <span className={`label mt-3 leading-relaxed ${active ? "text-grey-300" : "text-grey-500"}`}>
        {t(`mode.${id}.hint` as StringKey)}
      </span>
    </button>
  );
}
```

Re-add the `StringKey` import from `@/client/i18n`, and update the call site in `ModePicker` to pass `id={id}`. The grid stays `sm:grid-cols-2` — three cards over two columns leaves one cell empty on the last row, so add a blank filler the way `PlaylistPicker` does:

```tsx
        {MODE_ORDER.length % 2 === 1 && (
          <div aria-hidden className="hidden bg-paper sm:block" />
        )}
```

- [ ] **Step 3: Filter the playlist picker to what the mode can play**

In `src/client/components/PlaylistPicker.tsx`, take the mode as a prop:

```tsx
export function PlaylistPicker({
  mode,
  value,
  disabled,
  onSelect,
}: {
  mode: GameModeId;
  value: SongSource;
  disabled: boolean;
  onSelect: (source: SongSource) => void;
}) {
```

Add `GameModeId` to the existing type import from `@/shared/types`, import `sourceSuitsMode` from `@/shared/match-config` and `MODES` from `@/shared/modes`, then at the top of the component:

```tsx
  // A mode that asks what a song is from can only be played against a playlist
  // that says. Rather than grey the rest out, they are simply not offered —
  // there is nothing a host could learn from a tile they can never pick.
  const groups = PLAYLIST_GROUPS.filter(({ ids }) =>
    ids.some((id) => sourceSuitsMode(mode, { kind: "playlist", playlist: id })),
  );
  const showArtist = !MODES[mode].requiresSeries;
```

Map `groups` instead of `PLAYLIST_GROUPS` in the top-level grid, wrap the artist `TopCell` in `{showArtist && ...}`, and inside a group panel filter its ids the same way before mapping.

- [ ] **Step 4: Correct the source when the mode changes**

In `src/client/components/LobbyScreen.tsx`, import `defaultSourceForMode` from `@/shared/match-config` and change the two picker call sites:

```tsx
          <ModePicker
            value={room.config.mode}
            disabled={!isHost}
            // Sent as one patch, so the lobby is never briefly showing a
            // pairing the server would refuse.
            onSelect={(mode) =>
              patch({ mode, source: defaultSourceForMode(mode, room.config.source) })
            }
          />
```

```tsx
          <PlaylistPicker
            mode={room.config.mode}
            value={room.config.source}
            disabled={!isHost}
            onSelect={(source) => patch({ source })}
          />
```

- [ ] **Step 5: Check it in a browser**

```bash
PORT=4123 npm run dev
```

Verify, at `http://localhost:4123`: three mode cards with no empty black grid cell; selecting **ทายอนิเมะ** moves the playlist step to the anime group alone with no by-artist tile; the step-2 summary line updates; selecting **ทายเพลง** again leaves the anime playlist selected and restores the other groups. Stop the dev server by its exact PID when done — never by pattern.

- [ ] **Step 6: Run the tests**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modes/index.ts src/client/components/ModePicker.tsx src/client/components/PlaylistPicker.tsx src/client/components/LobbyScreen.tsx
git commit -m "$(cat <<'EOF'
Offer the anime mode, and only the playlists it can play

The playlists a requiresSeries mode cannot use are not offered rather
than greyed out — there is nothing a host could learn from a tile they
can never pick — and the by-artist tile goes with them, since an artist
pool has no shows in it.

Switching into the mode sends the mode and a workable source as one
patch, so the lobby is never briefly showing a pairing the server would
refuse. Switching out leaves the anime playlist alone: it is a perfectly
good pool for "which song is this?".

QuizCard becomes PlainCard on the way past, since it hardcoded its own
copy and a third plain card could not reuse it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Show the answer

The reveal has to name the show, or a correct guess never gets confirmed as the thing it was.

**Files:**
- Modify: `src/client/components/RevealScreen.tsx:80-85`
- Modify: `src/client/components/HomeScreen.tsx:95` (verify only)

**Interfaces:**
- Consumes: `Track.series` from Task 1
- Produces: nothing

- [ ] **Step 1: Add the series line**

In `src/client/components/RevealScreen.tsx`, after the artist line:

```tsx
            {/* Only the anime playlists carry this, and in the anime mode it
                is the answer — so it sits in the accent, above the artist's
                grey, rather than reading as one more piece of metadata. */}
            {reveal.track.series && (
              <p className="label mt-2 text-accent">{reveal.track.series}</p>
            )}
```

- [ ] **Step 2: Confirm the home screen stat moved on its own**

`src/client/components/HomeScreen.tsx:95` renders `String(MODE_ORDER.length)`, which became 3 in Task 7. Read the line and confirm; no edit should be needed.

- [ ] **Step 3: Check it in a browser**

```bash
PORT=4123 npm run dev
```

Play a one-player anime match through to a reveal and confirm the show's name appears in the accent colour under the artist, and that a non-anime playlist's reveal is unchanged. Stop the dev server by its exact PID.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/client/components/RevealScreen.tsx
git commit -m "$(cat <<'EOF'
Name the show on the reveal

In the anime mode this is the answer, so it takes the accent rather than
sitting in the artist's grey as one more piece of metadata. Absent on
every playlist that does not carry it, which is all of them but one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

Do not deploy. A pm2 restart destroys every live room, and that step is the user's to ask for.
