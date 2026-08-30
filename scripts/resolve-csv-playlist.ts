/**
 * Turn a Spotify CSV export into the iTunes track ids a Playlist needs.
 *
 *   npx tsx scripts/resolve-csv-playlist.ts src/data/seeds/hits-source.csv \
 *     src/data/seeds/hits.ts HITS_TRACK_IDS
 *
 * Searches once per unique lead artist rather than once per track — sixty-odd
 * requests instead of two hundred and fifty — because the Search API starts
 * answering 403 well before that and stays there for hours. The current Thai
 * chart is folded in first, since it costs one request and a trending playlist
 * is mostly already on it.
 *
 * Slow on purpose. It is a build step, not something a player ever waits for.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SEARCH = "https://itunes.apple.com/search";
const CHART = "https://rss.marketingtools.apple.com/api/v2/th/music/most-played/100/songs.json";
const LOOKUP = "https://itunes.apple.com/lookup";

/** Seconds between requests, and how long to wait out a rejection. */
const PACE_MS = 5_000;
const BLOCKED_WAIT_MS = 60_000;
const MAX_TRIES = 6;

type Row = { artists: string[]; title: string };
type Candidate = {
  trackId: number;
  trackName: string;
  artistName: string;
  releaseDate?: string;
  kind?: string;
  previewUrl?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Strip everything that varies between the two catalogues: bracketed suffixes,
 * "- Live Session" tails, feature credits, then all punctuation and spacing.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\s+-\s+.*$/, " ")
    .replace(/feat\.?.*$/, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function parseCsv(path: string): Row[] {
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/).slice(1);
  return lines.flatMap((line) => {
    const comma = line.lastIndexOf(",");
    if (comma < 0) return [];
    const artists = line
      .slice(0, comma)
      .split(";")
      .map((a) => a.trim())
      .filter(Boolean);
    const title = line.slice(comma + 1).trim();
    return artists.length && title ? [{ artists, title }] : [];
  });
}

let lastRequest = 0;
async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const wait = PACE_MS - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
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

/** How well a candidate answers what the CSV row asked for. */
function score(c: Candidate, row: Row): number {
  const wantTitle = norm(row.title);
  const wantLead = norm(row.artists[0]!);
  const gotTitle = norm(c.trackName ?? "");
  const gotArtist = norm(c.artistName ?? "");
  let s = 0;
  if (gotTitle === wantTitle) s += 6;
  else if (wantTitle && (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle))) s += 4;
  if (gotArtist === wantLead) s += 3;
  else if (wantLead && (gotArtist.includes(wantLead) || wantLead.includes(gotArtist))) s += 2;
  // iTunes sometimes gives a featured act top billing.
  else if (row.artists.slice(1).some((a) => {
    const o = norm(a);
    return o && (gotArtist.includes(o) || o.includes(gotArtist));
  })) s += 1;
  return s;
}

async function main() {
  const [csvPath, outPath, exportName] = process.argv.slice(2);
  if (!csvPath || !outPath || !exportName) {
    console.error("usage: resolve-csv-playlist.ts <csv> <out.ts> <EXPORT_NAME>");
    process.exit(1);
  }

  const rows = parseCsv(csvPath);
  const pool = new Map<number, Candidate>();
  const keep = (results: Candidate[] | undefined) => {
    for (const r of results ?? []) {
      if (r.kind === "song" && r.previewUrl && r.trackId) pool.set(r.trackId, r);
    }
  };

  const chart = await getJson<{ feed?: { results?: Array<{ id?: string }> } }>(CHART);
  const chartIds = (chart?.feed?.results ?? []).map((r) => r.id).filter(Boolean);
  if (chartIds.length) {
    const q = new URLSearchParams({ id: chartIds.join(","), country: "TH", entity: "song" });
    keep((await getJson<{ results?: Candidate[] }>(`${LOOKUP}?${q}`))?.results);
  }
  console.error(`chart gave ${pool.size} tracks`);

  const leads = [...new Set(rows.map((r) => r.artists[0]!))];
  for (const [i, artist] of leads.entries()) {
    const q = new URLSearchParams({
      term: artist, media: "music", entity: "song", country: "TH", limit: "50",
    });
    keep((await getJson<{ results?: Candidate[] }>(`${SEARCH}?${q}`))?.results);
    console.error(`${i + 1}/${leads.length}  ${artist}  (pool ${pool.size})`);
  }

  const chosen = new Map<number, Candidate>();
  let missed = 0;
  for (const row of rows) {
    let best: Candidate | null = null;
    let bestScore = 0;
    for (const c of pool.values()) {
      const s = score(c, row);
      if (s > bestScore) { best = c; bestScore = s; }
    }
    if (best && bestScore >= 6) chosen.set(best.trackId, best);
    else missed++;
  }

  const sorted = [...chosen.values()].sort((a, b) =>
    (a.artistName + a.trackName).localeCompare(b.artistName + b.trackName),
  );
  const body = [
    "/**",
    ` * Resolved from ${csvPath.split("/").pop()} by scripts/resolve-csv-playlist.ts.`,
    " *",
    " * Ids rather than names on purpose: the list names exact recordings, so what",
    " * plays is what was chosen, and one lookup request fetches the lot.",
    " *",
    ` * ${sorted.length} of ${rows.length} tracks resolved. The rest are not on the Thai`,
    " * iTunes storefront, or are there under a title too different to match.",
    " */",
    `export const ${exportName}: readonly string[] = [`,
    ...sorted.map((c) => `  "${c.trackId}", // ${c.artistName} — ${c.trackName}`),
    "];",
    "",
  ].join("\n");
  writeFileSync(outPath, body);
  console.error(`\nresolved ${sorted.length}/${rows.length} (missed ${missed}) -> ${outPath}`);
}

void main();
