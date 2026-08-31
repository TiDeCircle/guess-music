/**
 * Builds a real pool for every Playlist and reports whether a Match could
 * actually run on it, including at extreme difficulty. Hits the live iTunes
 * API, so it is a manual check rather than part of `npm test`.
 *
 *   npx tsx scripts/check-playlists.ts
 */
import { buildPool } from "@/server/catalog";
import { PLAYLIST_IDS, PLAYLISTS } from "@/data/seeds";
import { quizMode } from "@/shared/modes";
import { DIFFICULTIES } from "@/shared/difficulty";
import { makeRng } from "@/shared/rng";

async function main() {
  let failed = 0;

  for (const id of PLAYLIST_IDS) {
    const started = Date.now();
    try {
      const rng = makeRng(42);
      const pool = await buildPool({ kind: "playlist", playlist: id }, rng);
      const artists = new Set(pool.map((t) => t.artistId)).size;
      const years = pool.map((t) => t.year).filter(Boolean);
      const span = years.length
        ? `${Math.min(...years)}-${Math.max(...years)}`
        : "?";

      const rounds = quizMode.buildRounds({
        pool,
        count: 10,
        difficulty: DIFFICULTIES.extreme,
        rng,
      });
      // The choices carry a title and nothing else now, so who sang a decoy is
      // looked up in the pool it came from.
      const artistOf = new Map(pool.map((t) => [t.id, t.artist]));
      const fullDecoys = rounds.filter(
        (r) =>
          r.choices.filter(
            (c) => c.id !== r.answer.id && artistOf.get(c.id) === r.answer.artist,
          ).length === 2,
      ).length;

      if (rounds.length < 10) failed++;

      console.log(
        `${id.padEnd(14)} [${PLAYLISTS[id].source.kind.padEnd(7)}] ` +
          `${String(pool.length).padStart(4)} songs / ${String(artists).padStart(3)} artists / ` +
          `${span.padEnd(10)} | rounds ${rounds.length}/10 | ` +
          `extreme decoys ${fullDecoys}/10 | ${Date.now() - started}ms`,
      );
      const first = rounds[0];
      if (first) {
        console.log(
          `${" ".repeat(15)}e.g. ${first.answer.artist} - ${first.answer.title} (${first.answer.year})`,
        );
      }
    } catch (err) {
      failed++;
      console.log(`${id.padEnd(14)} FAILED: ${(err as Error).message}`);
    }
  }

  console.log(failed === 0 ? "\nall playlists playable" : `\n${failed} playlist(s) unplayable`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
