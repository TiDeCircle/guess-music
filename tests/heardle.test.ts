import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import {
  HEARDLE_MAX_WRONG,
  heardleCoopMode,
  heardleMode,
  quizMode,
  stageAt,
} from "@/shared/modes";
import {
  BASE_POINTS,
  HEARDLE_MIN_CORRECT,
  HEARDLE_WRONG_PENALTY,
  MAX_TIME_BONUS,
  heardleTierPoints,
  scoreHeardle,
} from "@/shared/scoring";

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

const rounds = (mode = heardleMode, difficulty = DIFFICULTIES.medium) =>
  mode.buildRounds({ pool: pool(), count: 5, difficulty, rng: makeRng(7) });

describe("heardle stages", () => {
  const stages = DIFFICULTIES.medium.heardleStages;

  it("puts the opening moment in the top tier", () => {
    expect(stageAt(stages, 0)).toBe(0);
    expect(stageAt(stages, 999)).toBe(0);
  });

  it("drops a tier exactly on each mark", () => {
    // The mark is the end of its tier, so landing on it is already the next one.
    expect(stageAt(stages, 1_000)).toBe(1);
    expect(stageAt(stages, 1_999)).toBe(1);
    expect(stageAt(stages, 2_000)).toBe(2);
  });

  it("keeps the last tier open through the silence after the music", () => {
    const last = stages.length - 1;
    expect(stageAt(stages, stages[last]! + 4_000)).toBe(last);
  });

  it("runs the music to the last mark and then allows five more seconds", () => {
    const last = DIFFICULTIES.medium.heardleStages.at(-1)!;
    for (const plan of rounds()) {
      expect(plan.stagesMs).toEqual(DIFFICULTIES.medium.heardleStages);
      expect(plan.clipMs).toBe(last);
      expect(plan.answerWindowMs).toBe(last + 5_000);
    }
  });

  it("leaves quiz without stages, so it keeps its continuous bonus", () => {
    const quiz = quizMode.buildRounds({
      pool: pool(),
      count: 3,
      difficulty: DIFFICULTIES.medium,
      rng: makeRng(7),
    });
    for (const plan of quiz) expect(plan.stagesMs).toEqual([]);
  });

  it("tightens the top tier as the difficulty rises", () => {
    const easy = DIFFICULTIES.easy.heardleStages[0]!;
    const extreme = DIFFICULTIES.extreme.heardleStages[0]!;
    expect(extreme).toBeLessThan(easy);
  });
});

describe("heardle scoring", () => {
  it("pays the same at both ends as a quiz round does", () => {
    // A match must be worth the same whichever mode a room picks, or the choice
    // stops being about how you want to play.
    expect(heardleTierPoints(0, 6, 1)).toBe(BASE_POINTS + MAX_TIME_BONUS);
    expect(heardleTierPoints(5, 6, 1)).toBe(BASE_POINTS);
  });

  it("pays everyone in the same stretch of music the same", () => {
    const stages = DIFFICULTIES.medium.heardleStages;
    const a = stageAt(stages, 4_100);
    const b = stageAt(stages, 6_900);
    expect(a).toBe(b);
  });

  it("charges for each wrong guess", () => {
    const clean = scoreHeardle({
      correct: true,
      stageIndex: 0,
      stageCount: 6,
      wrongAttempts: 0,
      multiplier: 1,
    });
    const once = scoreHeardle({
      correct: true,
      stageIndex: 0,
      stageCount: 6,
      wrongAttempts: 1,
      multiplier: 1,
    });
    expect(clean - once).toBe(HEARDLE_WRONG_PENALTY);
  });

  it("never lets a correct answer fall to nothing", () => {
    const scraped = scoreHeardle({
      correct: true,
      stageIndex: 5,
      stageCount: 6,
      wrongAttempts: 99,
      multiplier: 1,
    });
    expect(scraped).toBe(HEARDLE_MIN_CORRECT);
  });

  it("pays a wrong answer nothing, however early", () => {
    expect(
      scoreHeardle({
        correct: false,
        stageIndex: 0,
        stageCount: 6,
        wrongAttempts: 0,
        multiplier: 2,
      }),
    ).toBe(0);
  });

  it("applies the difficulty multiplier to the floor as well", () => {
    const scraped = scoreHeardle({
      correct: true,
      stageIndex: 5,
      stageCount: 6,
      wrongAttempts: 99,
      multiplier: 2,
    });
    expect(scraped).toBe(HEARDLE_MIN_CORRECT * 2);
  });
});

describe("heardle judging", () => {
  const plan = rounds()[0]!;
  const wrongIds = plan.choices.filter((c) => c.id !== plan.answer.id).map((c) => c.id);

  it("keeps the round open after the first wrong guess", () => {
    const out = heardleMode.judge({
      plan,
      choiceId: wrongIds[0]!,
      elapsedMs: 500,
      wrongSoFar: [],
    });
    expect(out).toEqual({ correct: false, gained: 0, final: false });
  });

  it("closes it on the last one allowed", () => {
    const out = heardleMode.judge({
      plan,
      choiceId: wrongIds[1]!,
      elapsedMs: 500,
      wrongSoFar: [wrongIds[0]!],
    });
    expect(out.final).toBe(true);
    expect(HEARDLE_MAX_WRONG).toBe(2);
  });

  it("pays the tier the clip had reached, minus what was already spent", () => {
    const early = heardleMode.judge({
      plan,
      choiceId: plan.answer.id,
      elapsedMs: 200,
      wrongSoFar: [],
    });
    const late = heardleMode.judge({
      plan,
      choiceId: plan.answer.id,
      elapsedMs: 12_000,
      wrongSoFar: [],
    });
    const earlyButBurnt = heardleMode.judge({
      plan,
      choiceId: plan.answer.id,
      elapsedMs: 200,
      wrongSoFar: [wrongIds[0]!],
    });

    expect(early.gained).toBeGreaterThan(late.gained);
    expect(earlyButBurnt.gained).toBe(early.gained - HEARDLE_WRONG_PENALTY);
    expect(early.final).toBe(true);
  });

  it("judges both heardle modes identically — only who owns the round differs", () => {
    const input = { plan, choiceId: plan.answer.id, elapsedMs: 3_000, wrongSoFar: [] };
    expect(heardleCoopMode.judge(input)).toEqual(heardleMode.judge(input));
    expect(heardleMode.shared).toBe(false);
    expect(heardleCoopMode.shared).toBe(true);
    expect(quizMode.shared).toBe(false);
  });
});
