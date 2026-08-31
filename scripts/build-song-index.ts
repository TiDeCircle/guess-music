/**
 * Build the song list the Heardle answer box searches.
 *
 *   npx tsx scripts/build-song-index.ts
 *
 * Writes public/song-index.json.
 *
 * Why it has to be big: the list is what a player types against, and if it held
 * only the songs a Match is drawing from, two characters would narrow it to the
 * answer. Every artist the game ships is pulled in full, so finding a song in
 * the list tells you nothing about whether it is the one playing.
 *
 * Uses `lookup`, not `search` — one unthrottled request per artist. See
 * docs/adr/0005. It is a build step; no player ever waits for it.
 */
import { writeFileSync } from "node:fs";
import { ARTISTS } from "../src/data/seeds/artists";
import { ARTIST_IDS } from "../src/data/seeds/artist-ids";
import { HITS_TRACK_IDS } from "../src/data/seeds/hits";

const OUT = "public/song-index.json";
const META_OUT = "src/data/song-index-meta.ts";
const STOREFRONT = "TH";
const PACE_MS = 250;
const CHART_FEEDS = [
  "https://rss.applemarketingtools.com/api/v2/th/music/most-played/100/songs.json",
  "https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/songs.json",
  "https://rss.applemarketingtools.com/api/v2/kr/music/most-played/100/songs.json",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;
async function getJson(url: string): Promise<any> {
  const wait = PACE_MS - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/**
 * title + artist, flattened only as far as it is safe to.
 *
 * `\p{M}` is kept deliberately. Thai vowel signs and tone marks are Unicode
 * *marks*, not letters, so a class of `\p{L}\p{N}` drops them — and this key
 * decides which songs survive deduplication. Without the marks, จีบ collided
 * with จูบ and simply never made it into the file, so a player could type it
 * correctly and be told it does not exist. Same reasoning as `titleKeys` in
 * src/shared/answer.ts, which grades the answers.
 */
const key = (title: string, artist: string) =>
  `${title} ${artist}`.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\p{M} ]+/gu, "");

const byArtist = new Map<string, Map<string, string>>();
let seen = 0;

function add(title?: string, artist?: string): void {
  if (!title || !artist) return;
  seen++;
  const titles = byArtist.get(artist) ?? new Map<string, string>();
  // Two pressings of one recording differ only by id, and the answer box would
  // otherwise show the same line twice.
  const flat = key(title, artist);
  if (!titles.has(flat)) titles.set(flat, title);
  byArtist.set(artist, titles);
}

async function main(): Promise<void> {
  const named = ARTISTS.map((a) => a.name);
  let missing = 0;

  for (const [i, name] of named.entries()) {
    const id = ARTIST_IDS[name];
    if (id === undefined) {
      missing++;
      continue;
    }
    try {
      const body = await getJson(
        `https://itunes.apple.com/lookup?id=${id}&entity=song&limit=200&country=${STOREFRONT}`,
      );
      let kept = 0;
      for (const r of body.results ?? []) {
        if (r.wrapperType !== "track" || r.kind !== "song") continue;
        add(r.trackName, r.artistName);
        kept++;
      }
      if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${named.length} ...`);
      if (kept === 0) console.log(`  ! ${name}: ไม่มีเพลงกลับมา`);
    } catch (err) {
      console.log(`  ! ${name}: ${(err as Error).message}`);
    }
  }

  // The fixed playlist and the daily charts bring in artists the seed list does
  // not name; without them their songs would be unfindable in the answer box.
  for (let i = 0; i < HITS_TRACK_IDS.length; i += 40) {
    const ids = HITS_TRACK_IDS.slice(i, i + 40).join(",");
    const body = await getJson(
      `https://itunes.apple.com/lookup?id=${ids}&entity=song&limit=200&country=${STOREFRONT}`,
    );
    for (const r of body.results ?? []) add(r.trackName, r.artistName);
  }
  console.log("  + เพลงจาก playlist ที่กำหนดเอง");

  for (const feed of CHART_FEEDS) {
    try {
      const body = await getJson(feed);
      for (const r of body.feed?.results ?? []) add(r.name, r.artistName);
      console.log(`  + chart ${feed.split("/")[5]}`);
    } catch (err) {
      console.log(`  ! ${feed}: ${(err as Error).message}`);
    }
  }

  // Grouped by artist rather than a flat list of pairs: the artist name would
  // otherwise repeat dozens of times, and this file is shipped to every player
  // who opens a Heardle round.
  const artists = [...byArtist.entries()]
    .map(([artist, titles]) => [artist, [...titles.values()].sort()] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const songs = artists.reduce((n, [, titles]) => n + titles.length, 0);
  writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), artists }),
  );

  // The home screen states the size of this catalogue, and a number stated in
  // the UI has to come from the thing it describes rather than from someone
  // remembering to update it.
  writeFileSync(
    META_OUT,
    `/** Generated by scripts/build-song-index.ts. Do not edit. */\n\n` +
      `export const SONG_INDEX_SIZE = ${songs};\n` +
      `export const SONG_INDEX_ARTISTS = ${artists.length};\n` +
      `export const SONG_INDEX_BUILT = ${JSON.stringify(new Date().toISOString().slice(0, 10))};\n`,
  );

  console.log(`\n  ศิลปิน: ${artists.length}`);
  console.log(`  เพลงไม่ซ้ำ: ${songs} (ดึงมาทั้งหมด ${seen})`);
  console.log(`  ศิลปินที่ยังไม่มี id: ${missing}`);
  console.log(`  ไฟล์: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
