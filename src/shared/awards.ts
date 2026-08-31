import type { GameModeId, MatchSummary, Player } from "./types";

export type AwardId =
  | "lightning-fast"
  | "one-second-ear"
  | "iron-streak"
  | "clutch-master"
  | "clean-sheet"
  | "sniper"
  | "mvp-carry";

export type Award = {
  id: AwardId;
  playerId: string;
  value?: string | number;
};

/**
 * Pure function that evaluates the match summary and determines distinct awards
 * earned by players. Returns a mapping of playerId -> Award[].
 */
export function computeMatchAwards(
  summary: MatchSummary,
  players: Player[],
  mode: GameModeId = "quiz",
): Record<string, Award[]> {
  if (!summary.rounds || summary.rounds.length === 0 || players.length === 0) {
    return {};
  }

  const totalRounds = summary.rounds.length;
  const awardsByPlayer: Record<string, Award[]> = {};

  const addAward = (playerId: string, award: Award) => {
    if (!awardsByPlayer[playerId]) {
      awardsByPlayer[playerId] = [];
    }
    // Avoid duplicate award id for same player
    if (!awardsByPlayer[playerId].some((a) => a.id === award.id)) {
      awardsByPlayer[playerId].push(award);
    }
  };

  // Collect player statistics
  const stats: Record<
    string,
    {
      correctCount: number;
      correctElapsed: number[];
      maxStreak: number;
      currentStreak: number;
      level0Count: number;
      coopSubmissions: number;
      clutchCount: number;
    }
  > = {};

  for (const player of players) {
    stats[player.id] = {
      correctCount: 0,
      correctElapsed: [],
      maxStreak: 0,
      currentStreak: 0,
      level0Count: 0,
      coopSubmissions: 0,
      clutchCount: 0,
    };
  }

  for (const round of summary.rounds) {
    for (const res of round.results) {
      const pStats = stats[res.playerId];
      if (!pStats) continue;

      if (res.correct) {
        pStats.correctCount += 1;
        pStats.currentStreak += 1;
        if (pStats.currentStreak > pStats.maxStreak) {
          pStats.maxStreak = pStats.currentStreak;
        }

        if (res.elapsedMs != null && res.elapsedMs > 0) {
          pStats.correctElapsed.push(res.elapsedMs);
          // If answered in the tail end (e.g. > 8000ms or late)
          if (res.elapsedMs >= 8000) {
            pStats.clutchCount += 1;
          }
        }

        if (res.level === 0) {
          pStats.level0Count += 1;
        }

        if (mode === "heardle-coop" && res.byPlayerId) {
          const submitterStats = stats[res.byPlayerId];
          if (submitterStats) {
            submitterStats.coopSubmissions += 1;
          }
        }
      } else {
        pStats.currentStreak = 0;
      }
    }
  }

  // 1. Clean Sheet: 100% correct in >= 3 rounds
  if (totalRounds >= 3) {
    for (const player of players) {
      const s = stats[player.id];
      if (s && s.correctCount === totalRounds) {
        addAward(player.id, {
          id: "clean-sheet",
          playerId: player.id,
          value: `${totalRounds}/${totalRounds}`,
        });
      }
    }
  }

  // 2. Lightning Fast: Lowest average elapsedMs among correct answers (minimum 2 correct)
  let fastestPlayerId: string | null = null;
  let lowestAvgMs = Infinity;

  for (const player of players) {
    const s = stats[player.id];
    if (s && s.correctElapsed.length >= 2) {
      const avg =
        s.correctElapsed.reduce((a, b) => a + b, 0) / s.correctElapsed.length;
      if (avg < lowestAvgMs) {
        lowestAvgMs = avg;
        fastestPlayerId = player.id;
      }
    }
  }

  if (fastestPlayerId && lowestAvgMs < Infinity) {
    addAward(fastestPlayerId, {
      id: "lightning-fast",
      playerId: fastestPlayerId,
      value: `${(lowestAvgMs / 1000).toFixed(1)}s`,
    });
  }

  // 3. One-Second Ear: Most level 0 answers in Heardle
  if (mode === "heardle" || mode === "heardle-coop") {
    let maxLevel0 = 0;
    let earPlayerId: string | null = null;
    for (const player of players) {
      const s = stats[player.id];
      if (s && s.level0Count > maxLevel0) {
        maxLevel0 = s.level0Count;
        earPlayerId = player.id;
      }
    }
    if (earPlayerId && maxLevel0 >= 2) {
      addAward(earPlayerId, {
        id: "one-second-ear",
        playerId: earPlayerId,
        value: maxLevel0,
      });
    }
  }

  // 4. Iron Streak: Longest streak (>= 3)
  let maxStreak = 0;
  let streakPlayerId: string | null = null;
  for (const player of players) {
    const s = stats[player.id];
    if (s && s.maxStreak > maxStreak) {
      maxStreak = s.maxStreak;
      streakPlayerId = player.id;
    }
  }
  if (streakPlayerId && maxStreak >= 3) {
    addAward(streakPlayerId, {
      id: "iron-streak",
      playerId: streakPlayerId,
      value: maxStreak,
    });
  }

  // 5. MVP Carry (Co-op mode)
  if (mode === "heardle-coop") {
    let maxCoop = 0;
    let mvpPlayerId: string | null = null;
    for (const player of players) {
      const s = stats[player.id];
      if (s && s.coopSubmissions > maxCoop) {
        maxCoop = s.coopSubmissions;
        mvpPlayerId = player.id;
      }
    }
    if (mvpPlayerId && maxCoop >= 2) {
      addAward(mvpPlayerId, {
        id: "mvp-carry",
        playerId: mvpPlayerId,
        value: maxCoop,
      });
    }
  }

  // 6. Sniper: Highest accuracy (> 70%, but not clean-sheet)
  let highestCorrect = 0;
  let sniperPlayerId: string | null = null;
  for (const player of players) {
    const s = stats[player.id];
    if (
      s &&
      s.correctCount > highestCorrect &&
      s.correctCount < totalRounds &&
      s.correctCount / totalRounds >= 0.7
    ) {
      highestCorrect = s.correctCount;
      sniperPlayerId = player.id;
    }
  }
  if (sniperPlayerId) {
    addAward(sniperPlayerId, {
      id: "sniper",
      playerId: sniperPlayerId,
      value: `${highestCorrect}/${totalRounds}`,
    });
  }

  return awardsByPlayer;
}
