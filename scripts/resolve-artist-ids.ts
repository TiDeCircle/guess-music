/**
 * Resolve the artist names the game ships to iTunes artistIds.
 *
 *   npx tsx scripts/resolve-artist-ids.ts
 *
 * Rewrites src/data/seeds/artist-ids.ts, keeping whatever is already resolved
 * and adding the rest. An artist gets an id only when the search returns songs
 * credited to exactly that name, so a near-miss never quietly becomes a
 * different act's catalogue.
 *
 * Slow on purpose: the Search API answers 403 under load and stays there for
 * hours, so this paces itself and waits a full minute on every rejection.
 * It is a build step — no player ever waits for it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ARTISTS } from "../src/data/seeds/artists";
import { ARTIST_IDS } from "../src/data/seeds/artist-ids";

const OUT = "src/data/seeds/artist-ids.ts";
const PACE_MS = 5_000;
const BLOCKED_WAIT_MS = 60_000;
const MAX_TRIES = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

type Song = { artistId?: number; artistName?: string; kind?: string; previewUrl?: string };

let lastRequest = 0;
async function search(term: string): Promise<Song[] | null> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const wait = PACE_MS - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const q = new URLSearchParams({
      term, media: "music", entity: "song", country: "TH", limit: "50",
    });
    try {
      const res = await fetch(`https://itunes.apple.com/search?${q}`, {
        signal: AbortSignal.timeout(25_000),
      });
      if (res.status === 403 || res.status === 429) {
        console.error(`    blocked, waiting ${BLOCKED_WAIT_MS / 1000}s`);
        await sleep(BLOCKED_WAIT_MS);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { results?: Song[] }).results ?? [];
    } catch (err) {
      console.error(`    ${(err as Error).message}`);
      await sleep(10_000);
    }
  }
  return null;
}

async function main() {
  const resolved = new Map<string, number>(Object.entries(ARTIST_IDS));
  const pending = ARTISTS.filter((a) => !resolved.has(a.name));
  console.error(`${resolved.size} already resolved, ${pending.length} to go`);

  for (const [i, artist] of pending.entries()) {
    const results = await search(artist.name);
    if (!results) {
      console.error(`${i + 1}/${pending.length}  ${artist.name}  gave up`);
      continue;
    }
    // Only songs credited to exactly this name get a vote, so a fuzzy match
    // cannot hand us somebody else's catalogue.
    const votes = new Map<number, number>();
    for (const r of results) {
      if (r.kind !== "song" || !r.previewUrl || !r.artistId) continue;
      if (key(r.artistName ?? "") !== key(artist.name)) continue;
      votes.set(r.artistId, (votes.get(r.artistId) ?? 0) + 1);
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) resolved.set(artist.name, best[0]);
    console.error(
      `${i + 1}/${pending.length}  ${artist.name}  ${best ? best[0] : "no match"}`,
    );
  }

  const header = readFileSync(OUT, "utf8").split("export const")[0]!.trimEnd();
  const body = [
    header,
    "",
    "export const ARTIST_IDS: Record<string, number> = {",
    ...[...resolved.keys()]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((name) => `  ${JSON.stringify(name)}: ${resolved.get(name)},`),
    "};",
    "",
  ].join("\n");
  writeFileSync(OUT, body);
  console.error(`\n${resolved.size}/${ARTISTS.length} resolved -> ${OUT}`);
}

void main();
