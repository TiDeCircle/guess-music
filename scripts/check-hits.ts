/**
 * Audit a resolved playlist against the CSV it came from.
 *
 *   npx tsx scripts/check-hits.ts
 *
 * Two failures are possible and neither announces itself:
 *
 * - **Rot.** A track id stops resolving, or loses its preview, when a release
 *   leaves the storefront. The playlist quietly shrinks.
 * - **A wrong match.** Two songs can share a Thai title — the first run of this
 *   matched `LUMMUN — ผลข้างเคียง` to a row asking for Ink Waruntorn's song of
 *   the same name. The game stays self-consistent (the answer comes from the
 *   same record that plays), so nothing breaks; it simply stops being the
 *   playlist that was asked for.
 *
 * Costs one lookup request per hundred tracks and no searches, so it is safe to
 * run often.
 */
import { readFileSync } from "node:fs";

const CSV = "src/data/seeds/hits-source.csv";
const DATA = "src/data/seeds/hits.ts";
const LOOKUP = "https://itunes.apple.com/lookup";

/** Below this, a match is close enough to be worth a human look. */
const WEAK_SCORE = 8;

type Track = { trackId: number; trackName: string; artistName: string; kind?: string; previewUrl?: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\s+-\s+.*$/, " ")
    .replace(/feat\.?.*$/, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");

function csvRows(): Array<{ artist: string; title: string }> {
  return readFileSync(CSV, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const comma = line.lastIndexOf(",");
      if (comma < 0) return [];
      return [{
        artist: line.slice(0, comma).split(";")[0]!.trim(),
        title: line.slice(comma + 1).trim(),
      }];
    });
}

async function main() {
  const ids = [...readFileSync(DATA, "utf8").matchAll(/^\s*"(\d+)",/gm)].map((m) => m[1]!);
  const rows = csvRows();
  console.log(`${ids.length} ids, ${rows.length} rows in the source export`);

  const alive = new Map<string, Track>();
  for (let i = 0; i < ids.length; i += 100) {
    const q = new URLSearchParams({
      id: ids.slice(i, i + 100).join(","), country: "TH", entity: "song",
    });
    const res = await fetch(`${LOOKUP}?${q}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`lookup failed: HTTP ${res.status}`);
    for (const t of ((await res.json()) as { results?: Track[] }).results ?? []) {
      if (t.kind === "song") alive.set(String(t.trackId), t);
    }
  }

  const gone = ids.filter((id) => !alive.has(id));
  const silent = ids.filter((id) => alive.has(id) && !alive.get(id)!.previewUrl);
  for (const id of gone) console.log(`  GONE      ${id}`);
  for (const id of silent) {
    console.log(`  NO PREVIEW ${alive.get(id)!.artistName} — ${alive.get(id)!.trackName}`);
  }

  let weak = 0;
  for (const id of ids) {
    const t = alive.get(id);
    if (!t) continue;
    const gotTitle = norm(t.trackName);
    const gotArtist = norm(t.artistName);
    let best = 0;
    let bestRow = "";
    for (const row of rows) {
      const wantTitle = norm(row.title);
      const wantArtist = norm(row.artist);
      let s = 0;
      if (gotTitle === wantTitle) s += 6;
      else if (wantTitle && (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle))) s += 4;
      if (gotArtist === wantArtist) s += 3;
      else if (wantArtist && (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist))) s += 2;
      if (s > best) { best = s; bestRow = `${row.artist} — ${row.title}`; }
    }
    // A score of 8 is the normal shape of a collaboration: same song, billed to
    // more artists than the export listed. Below that is worth a look.
    if (best < WEAK_SCORE) {
      weak++;
      console.log(`  WEAK [${best}] ${t.artistName} — ${t.trackName}`);
      console.log(`               export asked for: ${bestRow}`);
    }
  }

  const bad = gone.length + silent.length + weak;
  console.log(
    `\n${alive.size}/${ids.length} resolve, ${silent.length} without preview, ${weak} weak matches`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

void main();
