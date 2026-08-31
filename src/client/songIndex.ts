"use client";

/**
 * The song list the Heardle answer box searches.
 *
 * Sixteen thousand titles, generated offline by scripts/build-song-index.ts.
 * The size is the point: if the list held only the songs a Match draws from,
 * two characters would narrow it to the answer, and a picker that hands you the
 * answer is worse than four options.
 *
 * Half a megabyte is a lot to send for a text field, so it is fetched once, on
 * demand, the first time a Heardle round loads — never for a Quiz match, and
 * never before the browser is otherwise idle waiting for audio to buffer.
 */

export type SongEntry = {
  title: string;
  artist: string;
  /** Title and artist flattened, for matching what someone types. */
  search: string;
  /**
   * The title alone, flattened, with and without its production suffix — what
   * somebody typing the song they know would produce.
   */
  exact: [string, string];
};

type IndexFile = {
  generatedAt: string;
  artists: Array<[string, string[]]>;
};

/**
 * Deliberately looser than the matcher in `shared/answer.ts`, which keeps Thai
 * marks because grading has to tell ฝุ่น from ฝน. Here they come off: this is a
 * search box, and someone typing fast without tone marks should still be shown
 * the song they mean — they submit the exact title by picking it.
 */
const flatten = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

let pending: Promise<SongEntry[]> | null = null;

/** Fetches the index once per session; every later caller gets the same array. */
export function loadSongIndex(): Promise<SongEntry[]> {
  if (pending) return pending;
  pending = fetch("/song-index.json")
    .then((res) => {
      if (!res.ok) throw new Error(`song index ${res.status}`);
      return res.json() as Promise<IndexFile>;
    })
    .then((file) => {
      const out: SongEntry[] = [];
      for (const [artist, titles] of file.artists) {
        for (const title of titles) {
          const bare = flatten(title);
          const core = flatten(
            title.replace(/[([{][^)\]}]*[)\]}]/gu, " ").replace(/\s[-–—]\s.*$/u, " "),
          );
          out.push({
            title,
            artist,
            search: bare + " " + flatten(artist),
            exact: [bare, core || bare],
          });
        }
      }
      return out;
    })
    .catch((err) => {
      // A failed fetch must not strand the round: the answer box falls back to
      // plain typing, and the server grades the text either way.
      console.error("[song index]", err);
      pending = null;
      return [];
    });
  return pending;
}

/**
 * At most this many songs by any one artist — among the *loose* matches only.
 *
 * The cap exists because the index is grouped by artist, so an unrestricted
 * scan of "แสง" handed back five Bodyslam songs and hid every other band with a
 * song by that name. Applying it to exact matches too was a worse bug: 11% of
 * the catalogue could not be found by typing its own title, because an artist
 * with a Live, a JP and an Unplugged version of the same song used up the
 * allowance before the version you meant.
 */
const PER_ARTIST = 2;

/**
 * The entries worth showing for what has been typed so far.
 *
 * Three tiers. A title typed in full is never held back, whoever recorded it —
 * that is the whole promise of the box. Below that, titles that *start* with
 * the query come before ones that merely contain it, and both are rationed per
 * artist so no single act can fill the list.
 */
export function searchSongs(
  index: readonly SongEntry[],
  query: string,
  limit = 8,
): SongEntry[] {
  const q = flatten(query);
  if (q.length === 0) return [];

  const exact: SongEntry[] = [];
  const starts: SongEntry[] = [];
  const contains: SongEntry[] = [];
  for (const entry of index) {
    if (entry.exact[0] === q || entry.exact[1] === q) exact.push(entry);
    else if (entry.search.startsWith(q)) starts.push(entry);
    else if (entry.search.includes(q)) contains.push(entry);
  }

  const out: SongEntry[] = exact.slice(0, limit);
  const seen = new Map<string, number>();
  for (const entry of [...starts, ...contains]) {
    if (out.length >= limit) break;
    const used = seen.get(entry.artist) ?? 0;
    if (used >= PER_ARTIST) continue;
    seen.set(entry.artist, used + 1);
    out.push(entry);
  }
  return out;
}
