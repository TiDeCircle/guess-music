import type { Lang } from "@/client/i18n";
import { PLAYLIST_PAGES } from "@/data/playlist-pages";
import { SITE_URL, artistPath, playlistPath } from "./site";
import { STRINGS } from "./strings";
import type { SongSource } from "./types";

/**
 * The public page a shared result points at: the one that says what was
 * played, and has a button that starts the same thing.
 */
export function shareUrl(source: SongSource): string {
  return (
    SITE_URL +
    (source.kind === "playlist" ? playlistPath(source.playlist) : artistPath(source.artist))
  );
}

/**
 * What a player posts after a Match.
 *
 * Right answers out of the total rather than points: "8/10" means something to
 * a friend who has never played, and 1,340 points does not. The score rides
 * along after it for the people who have. A co-op Match speaks for the team,
 * and drops the score, which is the team's too.
 */
export function shareMessage({
  lang,
  source,
  correct,
  total,
  score,
  team,
}: {
  lang: Lang;
  source: SongSource;
  correct: number;
  total: number;
  score: number;
  team: boolean;
}): string {
  if (lang === "th") {
    const what =
      source.kind === "playlist"
        ? PLAYLIST_PAGES[source.playlist].heading
        : `ทายเพลง ${source.artist}`;
    return team
      ? `ทีมเรา${what} ถูก ${correct}/${total} ข้อ มาแข่งกันไหม`
      : `${what} ถูก ${correct}/${total} ข้อ ได้ ${score} คะแนน มาแข่งกันไหม`;
  }
  const what =
    source.kind === "playlist" ? STRINGS[`playlist.${source.playlist}`].en : source.artist;
  return team
    ? `Our team got ${correct}/${total} on Guess Music · ${what}. Can you beat us?`
    : `I got ${correct}/${total} (${score} pts) on Guess Music · ${what}. Can you beat that?`;
}
