import { describe, expect, it } from "vitest";
import { computeMatchAwards, type Award } from "@/shared/awards";
import type { MatchSummary, Player } from "@/shared/types";

const mockTrack = {
  id: "1",
  title: "Song 1",
  artist: "Artist 1",
  artistId: 101,
  artworkUrl: "http://example.com/art.jpg",
  previewUrl: "http://example.com/audio.m4a",
  year: 2020,
};

describe("computeMatchAwards", () => {
  const players: Player[] = [
    { id: "p1", name: "Alice", score: 500, connected: true, muted: false },
    { id: "p2", name: "Bob", score: 400, connected: true, muted: false },
  ];

  it("awards lightning-fast to the player with fastest average correct answer", () => {
    const summary: MatchSummary = {
      rounds: [
        {
          index: 0,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 150, elapsedMs: 1200 },
            { playerId: "p2", correct: true, gained: 180, elapsedMs: 800 },
          ],
        },
        {
          index: 1,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 140, elapsedMs: 1400 },
            { playerId: "p2", correct: true, gained: 170, elapsedMs: 900 },
          ],
        },
      ],
    };

    const awards = computeMatchAwards(summary, players, "quiz");
    const p2Awards = awards["p2"] ?? [];
    expect(p2Awards.some((a) => a.id === "lightning-fast")).toBe(true);
  });

  it("awards iron-streak to the player with longest correct streak", () => {
    const summary: MatchSummary = {
      rounds: [
        {
          index: 0,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100 },
            { playerId: "p2", correct: false, gained: 0 },
          ],
        },
        {
          index: 1,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100 },
            { playerId: "p2", correct: true, gained: 100 },
          ],
        },
        {
          index: 2,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100 },
            { playerId: "p2", correct: false, gained: 0 },
          ],
        },
      ],
    };

    const awards = computeMatchAwards(summary, players, "quiz");
    const p1Awards = awards["p1"] ?? [];
    expect(p1Awards.some((a) => a.id === "iron-streak")).toBe(true);
  });

  it("awards one-second-ear in heardle mode to who gets most level 0 answers", () => {
    const summary: MatchSummary = {
      rounds: [
        {
          index: 0,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100, level: 0 },
            { playerId: "p2", correct: true, gained: 80, level: 1 },
          ],
        },
        {
          index: 1,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100, level: 0 },
            { playerId: "p2", correct: true, gained: 100, level: 0 },
          ],
        },
      ],
    };

    const awards = computeMatchAwards(summary, players, "heardle");
    const p1Awards = awards["p1"] ?? [];
    expect(p1Awards.some((a) => a.id === "one-second-ear")).toBe(true);
  });

  it("awards mvp-carry in co-op mode to who submitted most correct answers", () => {
    const summary: MatchSummary = {
      rounds: [
        {
          index: 0,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100, byPlayerId: "p1" },
            { playerId: "p2", correct: true, gained: 100, byPlayerId: "p1" },
          ],
        },
        {
          index: 1,
          track: mockTrack,
          results: [
            { playerId: "p1", correct: true, gained: 100, byPlayerId: "p1" },
            { playerId: "p2", correct: true, gained: 100, byPlayerId: "p1" },
          ],
        },
      ],
    };

    const awards = computeMatchAwards(summary, players, "heardle-coop");
    const p1Awards = awards["p1"] ?? [];
    expect(p1Awards.some((a) => a.id === "mvp-carry")).toBe(true);
  });

  it("handles no answers or empty summary gracefully without awards", () => {
    const summary: MatchSummary = { rounds: [] };
    const awards = computeMatchAwards(summary, players, "quiz");
    expect(awards).toEqual({});
  });
});
