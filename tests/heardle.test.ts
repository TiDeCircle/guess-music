import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import { heardleCoopMode, heardleMode, quizMode, unlockedMs } from "@/shared/modes";
import { BASE_POINTS, MAX_TIME_BONUS, heardleTierPoints } from "@/shared/scoring";

function pool(artists = 12, songs = 6): Track[] {
  const out: Track[] = [];
  for (let a = 0; a < artists; a++) {
    for (let s = 0; s < songs; s++) {
      out.push({
        id: `${a}-${s}`,
        title: `Song ${a}-${s}`,
        artist: `Artist ${a}`,
        artistId: a,
        artworkUrl: "https://example.test/art.jpg",
        previewUrl: `https://example.test/${a}-${s}.m4a`,
        year: 2000 + s,
      });
    }
  }
  return out;
}

const build = (difficulty = DIFFICULTIES.medium, count = 5) =>
  heardleMode.buildRounds({ pool: pool(), count, difficulty, rng: makeRng(7) });

describe("heardle rounds", () => {
  it("sends no options at all", () => {
    // The strongest version of "the answer is never on the wire": there is
    // nothing on screen to recognise it from.
    for (const plan of build()) expect(plan.choices).toEqual([]);
  });

  it("carries the unlock ladder, and runs the clip to its last step", () => {
    const ladder = DIFFICULTIES.medium.heardleStages;
    for (const plan of build()) {
      expect(plan.stagesMs).toEqual(ladder);
      expect(plan.clipMs).toBe(ladder.at(-1));
      // Long enough to type a Thai title in after the music has run out.
      expect(plan.answerWindowMs).toBeGreaterThan(plan.clipMs + 20_000);
    }
  });

  it("plays a pool too thin for quiz", () => {
    // Quiz cannot open a round it can't put four distinct options on, so three
    // songs give it nothing. Heardle has no options to fill and plays all three.
    const thin = pool(1, 3);
    const opts = { pool: thin, count: 3, difficulty: DIFFICULTIES.medium, rng: makeRng(3) };
    expect(heardleMode.buildRounds({ ...opts, rng: makeRng(3) })).toHaveLength(3);
    expect(quizMode.buildRounds({ ...opts, rng: makeRng(3) })).toHaveLength(0);
  });

  it("never repeats an answer inside a match", () => {
    const ids = build(DIFFICULTIES.medium, 8).map((r) => r.answer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves quiz without a ladder, so its clip stays fixed", () => {
    const quiz = quizMode.buildRounds({
      pool: pool(),
      count: 3,
      difficulty: DIFFICULTIES.medium,
      rng: makeRng(7),
    });
    for (const plan of quiz) expect(plan.stagesMs).toEqual([]);
  });

  it("gives less music at every step as the difficulty rises", () => {
    const easy = DIFFICULTIES.easy.heardleStages;
    const extreme = DIFFICULTIES.extreme.heardleStages;
    expect(easy).toHaveLength(extreme.length);
    for (const [i, ms] of extreme.entries()) expect(ms).toBeLessThan(easy[i]!);
  });
});

describe("unlock levels", () => {
  const ladder = DIFFICULTIES.medium.heardleStages;

  it("hands over the first step before anything is spent", () => {
    expect(unlockedMs(ladder, 0)).toBe(ladder[0]);
  });

  it("grows with each level and stops at the top", () => {
    expect(unlockedMs(ladder, 1)).toBe(ladder[1]);
    expect(unlockedMs(ladder, 99)).toBe(ladder.at(-1));
    expect(unlockedMs(ladder, -3)).toBe(ladder[0]);
  });

  it("has nothing to hand over in quiz", () => {
    expect(unlockedMs([], 0)).toBe(0);
  });
});

describe("heardle scoring", () => {
  it("pays the same at both ends as a quiz round does", () => {
    // A match must be worth the same whichever mode a room picks, or the choice
    // stops being about how you want to play.
    expect(heardleTierPoints(0, 4, 1)).toBe(BASE_POINTS + MAX_TIME_BONUS);
    expect(heardleTierPoints(3, 4, 1)).toBe(BASE_POINTS);
  });

  it("drops with every level spent", () => {
    const paid = [0, 1, 2, 3].map((l) => heardleTierPoints(l, 4, 1));
    for (let i = 1; i < paid.length; i++) expect(paid[i]!).toBeLessThan(paid[i - 1]!);
  });

  it("clamps a level outside the ladder", () => {
    expect(heardleTierPoints(-1, 4, 1)).toBe(heardleTierPoints(0, 4, 1));
    expect(heardleTierPoints(9, 4, 1)).toBe(heardleTierPoints(3, 4, 1));
  });
});

describe("heardle judging", () => {
  const plan = build()[0]!;
  const wrong = "A Completely Different Song";

  it("pays the level the guesser is standing on", () => {
    const top = heardleMode.judge({ plan, guess: plan.answer.title, elapsedMs: 500, level: 0 });
    const late = heardleMode.judge({ plan, guess: plan.answer.title, elapsedMs: 500, level: 3 });
    expect(top.correct).toBe(true);
    expect(top.final).toBe(true);
    expect(top.gained).toBeGreaterThan(late.gained);
  });

  it("does not care how long the guess took, only what it cost", () => {
    // The clock is a backstop here, not the currency — typing speed must not
    // become the thing being measured.
    const quick = heardleMode.judge({ plan, guess: plan.answer.title, elapsedMs: 200, level: 1 });
    const slow = heardleMode.judge({ plan, guess: plan.answer.title, elapsedMs: 30_000, level: 1 });
    expect(quick.gained).toBe(slow.gained);
  });

  it("spends a level on a wrong guess and keeps the round alive", () => {
    const out = heardleMode.judge({ plan, guess: wrong, elapsedMs: 500, level: 0 });
    expect(out).toEqual({ correct: false, gained: 0, final: false, level: 1 });
  });

  it("ends the round on a wrong guess at the top of the ladder", () => {
    const last = plan.stagesMs.length - 1;
    const out = heardleMode.judge({ plan, guess: wrong, elapsedMs: 500, level: last });
    expect(out.final).toBe(true);
    expect(out.gained).toBe(0);
    // Still capped: there is no level above the last one.
    expect(out.level).toBe(last);
  });

  it("accepts the title without its production suffix", () => {
    const suffixed = {
      ...plan,
      answer: { ...plan.answer, title: "ผลข้างเคียง (Love Effects) [feat. BILLKIN]" },
    };
    const out = heardleMode.judge({
      plan: suffixed,
      guess: "ผลข้างเคียง",
      elapsedMs: 500,
      level: 0,
    });
    expect(out.correct).toBe(true);
  });

  it("judges both heardle modes identically — only who owns the ladder differs", () => {
    const input = { plan, guess: plan.answer.title, elapsedMs: 3_000, level: 1 };
    expect(heardleCoopMode.judge(input)).toEqual(heardleMode.judge(input));
    expect(heardleMode.shared).toBe(false);
    expect(heardleCoopMode.shared).toBe(true);
    expect(heardleMode.typed && heardleCoopMode.typed).toBe(true);
    expect(quizMode.typed).toBe(false);
  });
});
