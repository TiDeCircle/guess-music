/**
 * Draft an anime playlist for review.
 *
 *   npx tsx scripts/draft-anime-playlist.ts
 *
 * AnimeThemes.moe knows which show every opening belongs to, but writes song
 * titles in romaji where the storefront writes them in Japanese — matching the
 * two catalogues by title alone scored 41/148 on a sample. So this goes
 * artist-first over a shortlist: find the act on iTunes, pull their whole
 * catalogue by id, and match the romaji inside a few dozen songs rather than
 * across the store. Finding the act is not a lookup but a small search of its
 * own — a name is not an identity, and "LiSA" is two different singers.
 *
 * The output is a CSV for a human to read, not a seed. Every theme is written
 * out, matched or not, so the review can see what was lost.
 *
 * Slow on purpose. It is a build step, not something a player ever waits for.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SEARCH = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";
const THEMES = "https://api.animethemes.moe/anime";
const OUT = "src/data/seeds/anime-source.csv";
/** Not tracked: a rerunnable crawl, not a source of truth. */
const CACHE = ".cache/anime-themes.json";

/** Seconds between iTunes requests, and how long to wait out a rejection. */
const PACE_MS = 5_000;
const BLOCKED_WAIT_MS = 60_000;
const MAX_TRIES = 6;

/** AnimeThemes sits behind a CDN that answers a bare fetch with 403. */
const UA = "guess-music/0.1";

/**
 * The acts whose anime work is the work people recognise. Confirmed against
 * AnimeThemes by name — a spelling it does not know contributes nothing, so
 * the script says so rather than failing quietly.
 */
const SHORTLIST = [
  "YOASOBI",
  "LiSA",
  "Aimer",
  "Kenshi Yonezu",
  "RADWIMPS",
  "Yorushika",
  "Eve",
  "Ado",
  "Official HIGE DANdism",
  "King Gnu",
  "Vaundy",
  "ReoNa",
  "Tatsuya Kitani",
  "Creepy Nuts",
  "SPYAIR",
  "UVERworld",
  "ONE OK ROCK",
  "FLOW",
  "Asian Kung-Fu Generation",
  "KANA-BOON",
  "Yuuri",
  "milet",
  "Hikaru Utada",
  "Mrs. GREEN APPLE",
  "Sakanaction",
  "MY FIRST STORY",
  "MAN WITH A MISSION",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Loose enough for punctuation and case, strict enough not to merge songs. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\s+-\s+.*$/, " ")
    .replace(/feat\.?.*$/, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");

type ItunesTrack = {
  trackId?: number;
  trackName?: string;
  artistId?: number;
  artistName?: string;
  kind?: string;
  previewUrl?: string;
};

let lastItunes = 0;

/** Paced and backed off, because the Search API 403s early and stays there. */
async function itunes<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const wait = PACE_MS - (Date.now() - lastItunes);
    if (wait > 0) await sleep(wait);
    lastItunes = Date.now();
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(25_000),
        headers: { "User-Agent": UA },
      });
      if (res.status === 403 || res.status === 429) {
        console.error(`    blocked, waiting ${BLOCKED_WAIT_MS / 1000}s`);
        await sleep(BLOCKED_WAIT_MS);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      console.error(`    ${(err as Error).message}`);
      await sleep(10_000);
    }
  }
  return null;
}

/**
 * Every iTunes artist that goes by this name.
 *
 * None of these acts are in src/data/seeds/artist-ids.ts — that map is the
 * Thai, international and K-pop seeds — so ids are resolved here, once, and
 * the deep catalogue then comes from the lookup endpoint, which does not
 * throttle (ADR 0005).
 *
 * Plural because a name is not an identity: searching "LiSA" returns
 * BLACKPINK's LISA first and the anime singer second, and both normalise to
 * the same string. The genre is the cheap tiebreak, and the caller does the
 * expensive one.
 */
async function artistCandidates(name: string): Promise<number[]> {
  const url = `${SEARCH}?${new URLSearchParams({
    term: name,
    media: "music",
    entity: "musicArtist",
    limit: "10",
  })}`;
  const body = await itunes<{
    results?: Array<{ artistId?: number; artistName?: string; primaryGenreName?: string }>;
  }>(url);
  const want = norm(name);
  const same = (body?.results ?? []).filter(
    (r) => r.artistId && norm(r.artistName ?? "") === want,
  );
  const anime = same.filter((r) => r.primaryGenreName === "Anime");
  const rest = same.filter((r) => r.primaryGenreName !== "Anime");
  return [...anime, ...rest].map((r) => r.artistId!);
}

/**
 * How wrong a pressing is for our purposes, lowest wins.
 *
 * `norm` strips bracketed suffixes so it can match romaji against the store,
 * which also means "CORE PRIDE" matches the live recording and the karaoke
 * track equally well. An instrumental is refused outright — there is no
 * opening to recognise — and anything reworked loses to the studio version.
 */
function versionPenalty(title: string): number {
  const t = title.toLowerCase();
  if (/instrumental|off vocal|karaoke|inst\./.test(t)) return Infinity;
  if (/\blive\b|remix|acoustic|cover|piano|orchestra|reprise/.test(t)) return 3;
  if (/ver\.|version|edit\b|mix\b|-hen\b|english/.test(t)) return 2;
  // A bracketed anything is still a variant of something plainer.
  if (/[([]/.test(t)) return 1;
  return 0;
}

async function catalogue(id: number): Promise<ItunesTrack[]> {
  const url = `${LOOKUP}?${new URLSearchParams({
    id: String(id),
    entity: "song",
    limit: "200",
    country: "TH",
  })}`;
  const body = await itunes<{ results?: ItunesTrack[] }>(url);
  return (body?.results ?? []).filter(
    (r) => r.kind === "song" && r.previewUrl && r.trackId && r.artistId === id,
  );
}

type Theme = { series: string; song: string; artist: string };

/**
 * Every theme AnimeThemes has, paged. One pass, reused for all 27 acts.
 *
 * Cached to disk because the crawl is twelve thousand rows over a hundred
 * pages, and the part of this script worth re-running is the matching.
 */
async function allThemes(): Promise<Theme[]> {
  if (existsSync(CACHE)) {
    const cached = JSON.parse(readFileSync(CACHE, "utf8")) as Theme[];
    console.log(`  ${cached.length} themes (cached — delete ${CACHE} to refetch)`);
    return cached;
  }

  const out: Theme[] = [];
  let url: string | null = `${THEMES}?${new URLSearchParams({
    "filter[has]": "animethemes",
    include: "animethemes.song.artists",
    "page[size]": "100",
  })}`;

  let page = 0;
  while (url) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`animethemes HTTP ${res.status}`);
    const body = (await res.json()) as {
      anime?: Array<{
        name?: string;
        animethemes?: Array<{
          song?: { title?: string; artists?: Array<{ name?: string }> };
        }>;
      }>;
      links?: { next?: string | null };
    };
    for (const a of body.anime ?? []) {
      for (const th of a.animethemes ?? []) {
        const song = th.song?.title;
        for (const artist of th.song?.artists ?? []) {
          if (a.name && song && artist.name) {
            out.push({ series: a.name, song, artist: artist.name });
          }
        }
      }
    }
    url = body.links?.next ?? null;
    if (++page % 20 === 0) console.log(`  ...${out.length} themes so far`);
    await sleep(300);
  }

  mkdirSync(".cache", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function main() {
  console.log("fetching AnimeThemes...");
  const themes = await allThemes();
  console.log(`  ${themes.length} themes\n`);

  const rows = ["series,song,artist,trackId,itunesTitle"];
  let matched = 0;
  let missed = 0;

  for (const name of SHORTLIST) {
    const mine = themes.filter((t) => norm(t.artist) === norm(name));
    if (mine.length === 0) {
      console.log(`${name.padEnd(26)} no themes under this spelling`);
      continue;
    }

    const ids = await artistCandidates(name);
    if (ids.length === 0) {
      console.log(`${name.padEnd(26)} no iTunes artist id`);
      continue;
    }

    // Whichever candidate actually sings these songs. A same-named act with a
    // catalogue full of other people's music matches nothing, which is the
    // signal — so try the next rather than write out thirty-three blanks.
    const wanted = new Set(mine.map((t) => norm(t.song)));
    let tracks: ItunesTrack[] = [];
    let byTitle = new Map<string, ItunesTrack>();
    for (const id of ids) {
      const found = await catalogue(id);
      // Keep the plainest pressing of each title rather than whichever came
      // back first.
      const index = new Map<string, ItunesTrack>();
      for (const t of found) {
        const title = t.trackName ?? "";
        if (versionPenalty(title) === Infinity) continue;
        const key = norm(title);
        const held = index.get(key);
        if (!held || versionPenalty(title) < versionPenalty(held.trackName ?? "")) {
          index.set(key, t);
        }
      }
      const overlap = [...wanted].filter((k) => index.has(k)).length;
      if (overlap > 0 || tracks.length === 0) {
        tracks = found;
        byTitle = index;
      }
      if (overlap > 0) break;
    }

    // One row per distinct song, not per theme: a song used as both an OP and
    // an insert is one recording and one row.
    const seen = new Set<string>();
    let hit = 0;
    for (const th of mine) {
      const key = `${th.series}|${norm(th.song)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const track = byTitle.get(norm(th.song));
      if (track) hit++;
      else missed++;
      rows.push(
        [
          cell(th.series),
          cell(th.song),
          cell(name),
          cell(track?.trackId ? String(track.trackId) : ""),
          cell(track?.trackName ?? ""),
        ].join(","),
      );
    }
    matched += hit;
    console.log(
      `${name.padEnd(26)} itunes=${String(tracks.length).padStart(3)} themes=${String(seen.size).padStart(3)} matched=${hit}`,
    );
  }

  writeFileSync(OUT, rows.join("\n") + "\n");
  const shows = new Set(
    rows.slice(1).filter((r) => !r.endsWith(',"",""')).map((r) => r.split('","')[0]),
  );
  console.log(
    `\nwrote ${OUT}\n  ${matched} matched, ${missed} missed, ~${shows.size} shows with at least one track`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
