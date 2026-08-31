/**
 * Deciding whether a typed song title is the right one.
 *
 * This lives alone, as pure functions, because it is the part of Heardle most
 * likely to be quietly wrong — and its failure mode is the worst one a guessing
 * game has: telling a player who knows the song that they do not.
 *
 * Two things make it tractable. The answer box normally submits a title the
 * player picked out of a list, so the common path is an exact string. And a
 * title is compared without its production suffix, because more than half the
 * catalogue carries one and nobody types "(Love Effects) [feat. BILLKIN]".
 */

/**
 * Everything a title picks up on the way to a streaming service:
 * `(Love Effects)`, `[feat. BILLKIN]`, `(From "…")`, `[Live Session]`.
 *
 * Stripped for comparison only — the real title is still what gets displayed,
 * since it is the one printed on the record.
 */
const BRACKETED = /[([{][^)\]}]*[)\]}]/gu;

/**
 * Everything after a spaced dash: iTunes writes "Song - Single Version" and
 * "Song - Remastered 2011" that way rather than in brackets.
 */
const DASH_SUFFIX = /\s[-–—]\s.*$/u;

/**
 * The comparable forms of one title: as printed, and with the suffix gone.
 *
 * Flattening removes the spaces along with the punctuation. Thai is written
 * without them, so where a title breaks across words is a matter of taste
 * rather than spelling, and "ไม่เป็นไร" must not lose to "ไม่ เป็นไร".
 */
export function titleKeys(raw: string): string[] {
  // \p{M} has to be kept explicitly. Thai vowel signs and tone marks are
  // Unicode *marks*, not letters, so a class of only \p{L}\p{N} quietly drops
  // them — and with them the difference between ฝุ่น and ฝน, จูบ and จีบ,
  // หนึ่งคืน and หนึ่งคน. Thirteen pairs in the shipped catalogue collide that
  // way, every one of them a round graded wrong.
  const flatten = (s: string) =>
    s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "");

  const full = flatten(raw);
  const core = flatten(raw.replace(BRACKETED, " ").replace(DASH_SUFFIX, " "));

  const keys: string[] = [];
  // A title that is nothing but a bracket — "(Reprise)" — would flatten to
  // nothing, and an empty key matches everything.
  for (const k of [full, core]) if (k.length > 0 && !keys.includes(k)) keys.push(k);
  return keys;
}

/**
 * Whether a typed guess names the given song.
 *
 * Only the title is compared, never the artist. A player who types the right
 * title has named the song; making them also produce the exact credit line —
 * "Tilly Birds & Palmy", "ATOM CHANAKAN & MAIYARAP" — would fail people who
 * knew the answer, which is the one outcome worth designing against.
 */
export function matchesTitle(guess: string, answerTitle: string): boolean {
  const guessed = titleKeys(guess);
  if (guessed.length === 0) return false;
  const answer = titleKeys(answerTitle);
  return guessed.some((g) => answer.includes(g));
}
