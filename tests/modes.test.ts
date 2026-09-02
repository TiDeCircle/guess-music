import { describe, expect, it } from "vitest";
import { MODES, MODE_ORDER, DEFAULT_MODE } from "@/shared/modes";
import { modeSchema } from "@/shared/protocol";
import { STRINGS } from "@/client/i18n";
import type { GameModeId } from "@/shared/types";

const ALL = Object.keys(MODES) as GameModeId[];

describe("mode registry", () => {
  // The wire schema is what actually guards the server: a mode in MODES but
  // not in the enum is unselectable, and the reverse is unplayable.
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
    // A default nobody can play would strand every new room.
    expect(MODES[DEFAULT_MODE].requiresSeries).toBe(false);
  });

  it("marks anime as the only mode that needs series data", () => {
    expect(MODES.anime.requiresSeries).toBe(true);
    for (const id of ALL) {
      if (id !== "anime") expect(MODES[id].requiresSeries).toBe(false);
    }
  });
});
