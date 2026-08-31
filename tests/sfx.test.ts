import { describe, expect, it } from "vitest";
import {
  CUES,
  SFX_MIX,
  cueDurationMs,
  cuePeakGain,
  outcomeCue,
  type Cue,
} from "@/client/sfx";

const ALL = Object.keys(CUES) as Cue[];

/** The cues that can sound while a clip is still playing. */
const DURING_ROUND: Cue[] = ["lock", "unlock"];

describe("cue shape", () => {
  it("gives every cue at least one audible tone", () => {
    for (const cue of ALL) {
      expect(CUES[cue].length).toBeGreaterThan(0);
      for (const tone of CUES[cue]) {
        expect(tone.ms).toBeGreaterThan(0);
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(1);
        // Outside roughly this band a tone is either felt as a thud or heard as
        // a whine, and neither is feedback.
        expect(tone.hz).toBeGreaterThan(200);
        expect(tone.hz).toBeLessThan(2000);
      }
    }
  });

  it("measures a cue to the end of its last tone, not the sum of them", () => {
    // The tones overlap on purpose, so a sum would overstate every cue.
    expect(cueDurationMs("unlock")).toBe(125);
    expect(cueDurationMs("lock")).toBe(55);
  });
});

/**
 * `weight-duration-matches-action`: a sound that outlasts the thing it reports
 * stops being feedback and becomes a jingle.
 */
describe("duration matches the action", () => {
  it("keeps anything that plays over the song out of the way", () => {
    for (const cue of DURING_ROUND) {
      expect(cueDurationMs(cue)).toBeLessThan(150);
    }
  });

  it("never lets a cue run long enough to be waited on", () => {
    for (const cue of ALL) {
      expect(cueDurationMs(cue)).toBeLessThanOrEqual(500);
    }
  });

  // The one moment this design is allowed to spend anything is the end of a
  // match, so it should be the longest thing here — and still under half a
  // second.
  it("gives the end of the match the most room", () => {
    for (const cue of ALL) {
      if (cue === "finish") continue;
      expect(cueDurationMs(cue)).toBeLessThan(cueDurationMs("finish"));
    }
  });
});

/**
 * `appropriate-no-punishing`: the fastest way to make a player mute a game is
 * to make failure louder than success. These are the assertions that stop a
 * later tweak from doing it by accident.
 */
describe("failure is never punished", () => {
  it("keeps a wrong answer quieter than a right one", () => {
    expect(cuePeakGain("wrong")).toBeLessThan(cuePeakGain("correct"));
  });

  it("keeps a wrong answer shorter than a right one", () => {
    expect(cueDurationMs("wrong")).toBeLessThan(cueDurationMs("correct"));
  });

  it("makes running out of time the quietest thing in the set", () => {
    for (const cue of ALL) {
      if (cue === "missed") continue;
      expect(cuePeakGain("missed")).toBeLessThan(cuePeakGain(cue));
    }
  });

  // A single flat tone reads as a note; two descending ones read as a verdict.
  it("does not let the wrong cue fall away from the player", () => {
    expect(CUES.wrong).toHaveLength(1);
  });
});

/**
 * `impl-default-subtle`: the interface is mixed under the music by construction
 * rather than by choosing quiet numbers, so no future cue can escape it.
 */
describe("the mix sits under the music", () => {
  it("scales every cue below the volume the player set", () => {
    expect(SFX_MIX).toBeGreaterThan(0);
    expect(SFX_MIX).toBeLessThan(0.5);
  });

  it("never reaches full scale even at the loudest cue and full volume", () => {
    for (const cue of ALL) {
      expect(cuePeakGain(cue) * SFX_MIX).toBeLessThan(0.2);
    }
  });
});

describe("outcomeCue", () => {
  it("has a cue for every way a round can end", () => {
    expect(outcomeCue("correct")).toBe("correct");
    expect(outcomeCue("wrong")).toBe("wrong");
    expect(outcomeCue("missed")).toBe("missed");
  });
});
