import { describe, expect, it } from "vitest";
import { VOLUME_STEPS, readVolumeStep, stepToVolume } from "@/client/useGame";

/** Mirrors the module default; asserted to be audible, not merely equal. */
const DEFAULT_VOLUME_STEP = readVolumeStep(null);

describe("stepToVolume", () => {
  it("is silent at zero and full at the top step", () => {
    expect(stepToVolume(0)).toBe(0);
    expect(stepToVolume(VOLUME_STEPS)).toBe(1);
  });

  it("stays inside 0..1 for out-of-range steps", () => {
    expect(stepToVolume(-3)).toBe(0);
    expect(stepToVolume(VOLUME_STEPS + 10)).toBe(1);
  });

  it("rises with every step", () => {
    for (let s = 1; s <= VOLUME_STEPS; s++) {
      expect(stepToVolume(s)).toBeGreaterThan(stepToVolume(s - 1));
    }
  });

  // The point of the curve: amplitude steps get larger as they go up, so the
  // change in perceived loudness stays roughly even.
  it("spaces the low steps closer together than the high ones", () => {
    const gap = (s: number) => stepToVolume(s) - stepToVolume(s - 1);
    expect(gap(1)).toBeLessThan(gap(VOLUME_STEPS));
  });
});

describe("readVolumeStep", () => {
  // The regression this exists for: a first-time visitor has no stored value,
  // and Number(null) is 0 — a valid step that would mute the game silently.
  it("treats a missing value as the default, not as silence", () => {
    expect(readVolumeStep(null)).toBe(DEFAULT_VOLUME_STEP);
    expect(readVolumeStep(null)).toBeGreaterThan(0);
  });

  it("honours a stored zero, which is a real choice", () => {
    expect(readVolumeStep("0")).toBe(0);
  });

  it("returns stored levels unchanged", () => {
    for (let s = 0; s <= VOLUME_STEPS; s++) {
      expect(readVolumeStep(String(s))).toBe(s);
    }
  });

  it("falls back to the default for junk and out-of-range values", () => {
    for (const raw of ["", "abc", "2.5", "-1", String(VOLUME_STEPS + 1), "NaN"]) {
      expect(readVolumeStep(raw), `raw: ${raw}`).toBe(DEFAULT_VOLUME_STEP);
    }
  });
});
