import { describe, expect, it } from "vitest";
import { shortTitle } from "@/client/songTitle";

describe("shortTitle", () => {
  // The case this exists for: iTunes credits every guest in the title, and one
  // of these blew a quiz tile to thirteen lines and pushed the other two
  // options off the bottom of the screen.
  it("drops a bracketed credit list", () => {
    expect(
      shortTitle(
        "เจ้าตาก (คาราบาว เดอะซีรี่ส์) [feat. Lomosonic, Rawint Samasutthi, Bancha Thearakrit]",
      ),
    ).toBe("เจ้าตาก (คาราบาว เดอะซีรี่ส์)");
  });

  it("drops more than one bracketed run", () => {
    expect(shortTitle("Song [Remastered] [feat. Someone]")).toBe("Song");
  });

  // Parentheses are usually part of the name a person would say out loud, so
  // they stay — "(Cloudy)" is how that song is known.
  it("keeps parentheses", () => {
    expect(shortTitle("ฉันต้องคิดถึงเธอแบบไหน (Cloudy)")).toBe(
      "ฉันต้องคิดถึงเธอแบบไหน (Cloudy)",
    );
  });

  it("leaves an ordinary title alone", () => {
    expect(shortTitle("เพื่อนรัก")).toBe("เพื่อนรัก");
  });

  it("tidies the space the removal leaves behind", () => {
    expect(shortTitle("Song  [feat. X]  ")).toBe("Song");
  });

  // Trimming to nothing would leave an unanswerable blank tile, so a title
  // that is entirely a bracket keeps what it had.
  it("never returns an empty string", () => {
    expect(shortTitle("[feat. Nobody]")).toBe("[feat. Nobody]");
    expect(shortTitle("   ")).toBe("   ");
  });

  it("leaves an unclosed bracket alone rather than eating the rest", () => {
    expect(shortTitle("Song [feat. X")).toBe("Song [feat. X");
  });
});
