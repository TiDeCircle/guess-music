import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/client/theme";

/**
 * The theme script is inlined into the document head as a string, so nothing
 * type-checks it and nothing bundles it. A typo would not fail the build — it
 * would just quietly stop working, and the only symptom is a white flash that
 * whoever chose dark mode sees and nobody else does.
 *
 * So it gets run here, against a stub of the two things it touches.
 */
function run(stored: string | null | (() => never)) {
  const attrs = new Map<string, string>();
  const root = {
    setAttribute: (k: string, v: string) => attrs.set(k, v),
  };
  const fakeDocument = { documentElement: root };
  const fakeStorage = {
    getItem: (key: string) => {
      if (typeof stored === "function") stored();
      return key === THEME_STORAGE_KEY ? (stored as string | null) : null;
    },
  };

  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("localStorage", fakeStorage);
  // eslint-disable-next-line no-eval
  (0, eval)(THEME_INIT_SCRIPT);
  return attrs;
}

afterEach(() => vi.unstubAllGlobals());

describe("the no-flash theme script", () => {
  it("stamps a saved dark choice before anything paints", () => {
    expect(run("dark").get("data-theme")).toBe("dark");
  });

  it("stamps a saved light choice, so it can beat a dark system setting", () => {
    expect(run("light").get("data-theme")).toBe("light");
  });

  it("stamps nothing when the visitor has never chosen", () => {
    // Nothing stamped is what lets the stylesheet fall through to the system
    // setting; writing a default here would freeze whatever it guessed.
    expect(run(null).has("data-theme")).toBe(false);
  });

  it("ignores a junk value rather than stamping it", () => {
    expect(run("chartreuse").has("data-theme")).toBe(false);
  });

  it("survives storage throwing, which private mode does", () => {
    // This runs before React does. If it throws, the page is blank.
    expect(() =>
      run(() => {
        throw new Error("blocked");
      }),
    ).not.toThrow();
  });
});
