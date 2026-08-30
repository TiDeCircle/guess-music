/**
 * Build an artist-mode pool for real and report whether a Match could run on
 * it. Hits the live iTunes API, so it is a manual check.
 *
 *   npx tsx scripts/check-artist.ts "Bodyslam"
 */
import { buildPool } from "@/server/catalog";
import { quizMode } from "@/shared/modes";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";
import { artistIdFor } from "@/server/itunes";

async function main() {
  const names = process.argv.slice(2);
  for (const artist of names) {
    const started = Date.now();
    try {
      const pool = await buildPool({ kind: "artist", artist }, makeRng(3));
      const rounds = quizMode.buildRounds({
        pool,
        count: 10,
        difficulty: DIFFICULTIES.hard,
        rng: makeRng(3),
      });
      const allSame = rounds.every((r) =>
        r.choices.every((c) => c.artist === r.answer.artist),
      );
      console.log(
        `${artist.padEnd(18)} id=${artistIdFor(artist) ?? "-"} ` +
          `${String(pool.length).padStart(3)} songs | rounds ${rounds.length}/10 | ` +
          `every option same artist: ${allSame} | ${Date.now() - started}ms`,
      );
      const first = rounds[0];
      if (first) {
        console.log(`${" ".repeat(19)}${first.choices.map((c) => c.title).join(" / ")}`);
      }
    } catch (err) {
      console.log(`${artist.padEnd(18)} FAILED: ${(err as Error).message}`);
    }
  }
}

void main();
