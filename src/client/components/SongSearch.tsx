"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/client/i18n";
import { loadSongIndex, searchSongs, type SongEntry } from "@/client/songIndex";

/**
 * The Heardle answer box.
 *
 * Typing is what makes the mode about knowing a song rather than recognising a
 * title on screen, and the list underneath is what makes typing survive contact
 * with Thai titles — nobody is spelling "ผลข้างเคียง (Love Effects) [feat.
 * BILLKIN]" against a clock.
 *
 * Picking off the list is the normal path, but free text is still accepted:
 * the server grades the string, so a song the index has never heard of is still
 * winnable by typing it.
 */
export function SongSearch({
  disabled,
  wrongGuesses,
  onGuess,
}: {
  disabled: boolean;
  /** Titles already tried and rejected this Round. */
  wrongGuesses: string[];
  onGuess: (title: string) => void;
}) {
  const { t } = useLang();
  const [index, setIndex] = useState<readonly SongEntry[]>([]);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void loadSongIndex().then((songs) => {
      if (live) setIndex(songs);
    });
    return () => {
      live = false;
    };
  }, []);

  // A new round: clear whatever was half-typed, and take the caret back so the
  // next guess starts on the keyboard rather than after a tap.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const tried = useMemo(
    () => new Set(wrongGuesses.map((g) => g.toLowerCase())),
    [wrongGuesses],
  );

  const matches = useMemo(() => {
    // Options already spent are dropped rather than shown struck: this list is
    // a keyboard shortcut, and offering a dead entry only invites a wasted tap.
    return searchSongs(index, query).filter((s) => !tried.has(s.title.toLowerCase()));
  }, [index, query, tried]);

  useEffect(() => setHighlight(0), [query]);

  const submit = (title: string) => {
    if (disabled || title.trim().length === 0) return;
    setQuery("");
    onGuess(title);
  };

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              // Enter takes the highlighted suggestion when there is one, and
              // otherwise sends the raw text — a song the index lacks is still
              // a legal answer.
              submit(matches[highlight]?.title ?? query);
            }
          }}
          placeholder={t("guessPlaceholder")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className="w-full border-b-2 border-ink bg-transparent pb-2 outline-none placeholder:text-grey-300 focus:border-accent disabled:border-grey-300 disabled:text-grey-300"
          style={{ fontSize: "var(--text-title)" }}
        />
      </div>

      {matches.length > 0 && !disabled && (
        <ul className="mt-px max-h-64 overflow-y-auto border-b border-ink">
          {matches.map((song, i) => (
            <li key={`${song.artist}|${song.title}`}>
              <button
                type="button"
                // The pointer must not steal focus from the input before the
                // click lands, or the field blurs and the keyboard closes.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(song.title)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-baseline justify-between gap-4 px-3 py-3 text-left transition-colors ${
                  i === highlight ? "bg-ink text-paper" : "bg-paper text-ink"
                }`}
              >
                <span className="min-w-0 truncate" style={{ fontSize: "var(--text-body)" }}>
                  {song.title}
                </span>
                <span
                  className={`label shrink-0 ${i === highlight ? "text-grey-300" : "text-grey-500"}`}
                >
                  {song.artist}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length > 0 && matches.length === 0 && !disabled && (
        <p className="label mt-3 text-grey-500">{t("guessNotInList")}</p>
      )}

      {wrongGuesses.length > 0 && (
        <div className="mt-6">
          <p className="label text-grey-500">{t("triedAlready")}</p>
          <ul className="mt-2">
            {wrongGuesses.map((g) => (
              <li
                key={g}
                className="border-b border-grey-300 py-2 text-grey-500 line-through decoration-1"
                style={{ fontSize: "var(--text-body)" }}
              >
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
