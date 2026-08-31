"use client";

/**
 * A song title cut down to what a player actually has to read.
 *
 * iTunes puts the full credit list in the title field, so a track can arrive as
 * `เจ้าตาก (คาราบาว เดอะซีรี่ส์) [feat. Lomosonic, Rawint Samasutthi, …]` with
 * ten names after it. On a quiz tile that ran to thirteen lines, blew the row
 * it was in past the height of the window and pushed the other two options off
 * the bottom of the screen.
 *
 * Only square brackets go. That is where iTunes puts the credits and the
 * remaster notes, while parentheses are usually part of the name a person would
 * say out loud — "(Cloudy)" is how that song is known, and cutting it would
 * make the option harder to recognise rather than easier.
 *
 * It also takes a little of the artist back out of the board. The names in a
 * feat. list are the same hint the artist line was, and this is a game about
 * the song.
 */
export function shortTitle(title: string): string {
  // Non-greedy and anchored on a closing bracket, so an unclosed one is left
  // alone rather than swallowing the rest of the title.
  const trimmed = title.replace(/\s*\[[^\]]*\]/g, "").trim();
  // A title that was nothing but a bracket would leave a blank, unanswerable
  // tile; better an ugly option than an impossible one.
  return trimmed === "" ? title : trimmed;
}
