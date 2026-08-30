import { describe, expect, it } from "vitest";
import { ARTISTS, isKnownArtist } from "@/data/seeds/artists";
import { sourceSchema } from "@/shared/protocol";

describe("artist allowlist", () => {
  it("ships a usable number of artists across every group", () => {
    expect(ARTISTS.length).toBeGreaterThan(100);
    for (const group of ["thai", "intl", "kpop"] as const) {
      expect(ARTISTS.filter((a) => a.group === group).length).toBeGreaterThan(20);
    }
  });

  it("has no duplicates", () => {
    const names = ARTISTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("recognises exactly the artists it ships", () => {
    for (const a of ARTISTS) expect(isKnownArtist(a.name)).toBe(true);
    // The allowlist is what stops a socket payload becoming a search term.
    expect(isKnownArtist("Bodyslam OR 1=1")).toBe(false);
    expect(isKnownArtist("")).toBe(false);
    expect(isKnownArtist("bodyslam")).toBe(false);
  });
});

describe("source schema", () => {
  it("accepts both kinds of source", () => {
    expect(sourceSchema.safeParse({ kind: "playlist", playlist: "thai-now" }).success).toBe(true);
    expect(sourceSchema.safeParse({ kind: "artist", artist: "Bodyslam" }).success).toBe(true);
  });

  it("rejects a source that names neither", () => {
    expect(sourceSchema.safeParse({ kind: "playlist", playlist: "nope" }).success).toBe(false);
    expect(sourceSchema.safeParse({ kind: "artist" }).success).toBe(false);
    expect(sourceSchema.safeParse({ kind: "whatever", artist: "x" }).success).toBe(false);
  });

  it("bounds the artist name, leaving the allowlist to do the real check", () => {
    expect(sourceSchema.safeParse({ kind: "artist", artist: "" }).success).toBe(false);
    expect(sourceSchema.safeParse({ kind: "artist", artist: "x".repeat(65) }).success).toBe(false);
  });
});
