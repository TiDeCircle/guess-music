"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RoomListing } from "@/shared/types";
import { useLang, type StringKey } from "@/client/i18n";
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "@/shared/protocol";
import { PLAYLIST_GROUPS } from "@/data/seeds";
import { ARTISTS } from "@/data/seeds/artists";
import { MODE_ORDER } from "@/shared/modes";
import { SONG_INDEX_SIZE } from "@/data/song-index-meta";
import { Button } from "./Button";
import { FieldLabel } from "./Shell";
import { RoomBrowser } from "./RoomBrowser";

/** How far apart the parts of the screen arrive, in milliseconds. */
const STAGGER_MS = 90;

/**
 * Remembered across visits, unlike the session in `useGame` — that one is
 * scoped to reclaiming a single room and is cleared the moment you leave it
 * on purpose. A nickname is not tied to any one room, so leaving should not
 * cost it.
 */
const NAME_KEY = "guess-music.name";

/**
 * The way in.
 *
 * Two things happen here and only two: you start a room or you get into one.
 * They used to run together down a single column, with the list of open rooms
 * stranded at the far end of the page — even though clicking a room in that
 * list *is* joining, and is the way most people will do it. They are two routes
 * now, side by side with a rule between them, and everything that joins a room
 * lives on the joining side.
 *
 * The name sits above both, because neither route works without one.
 */
export function HomeScreen({
  onCreate,
  onJoin,
  rooms,
  busy,
}: {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  rooms: RoomListing[];
  busy: boolean;
}) {
  const { t, lang } = useLang();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const named = trimmedName.length > 0 && !busy;
  const canJoinByCode = named && code.trim().length === ROOM_CODE_LENGTH;

  /**
   * Put the caret in the name field, but only where there is a mouse.
   *
   * Both routes are disabled until a name exists, so landing with the caret
   * already there says what to do without a line of copy saying it. On a phone
   * the same autofocus throws up a keyboard that covers the page before anyone
   * has read it, which is why this asks about the pointer first.
   */
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) nameRef.current?.focus();
  }, []);

  // Read after mount, not during render: the server has no idea what name
  // this visitor used last time, and rendering it up front would mismatch
  // the markup Next.js sent down.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {
      // Private mode and blocked site data both land here; the field just
      // starts blank, same as before this existed.
    }
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    try {
      localStorage.setItem(NAME_KEY, value);
    } catch {
      // See above.
    }
  };

  const playlistCount = PLAYLIST_GROUPS.reduce((n, g) => n + g.ids.length, 0);
  const stats: Array<[StringKey, string]> = [
    ["statModes", String(MODE_ORDER.length)],
    ["statPlaylists", String(playlistCount)],
    ["statArtists", String(ARTISTS.length)],
    ["statSongs", SONG_INDEX_SIZE.toLocaleString(lang === "th" ? "th-TH" : "en-US")],
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid gap-12 md:grid-cols-12 md:gap-8">
        <section className="md:col-span-7">
          {/* The one place the design shouts. A Swiss poster earns its
              whitespace by putting a single large statement against it. */}
          <h1
            className="rise text-balance font-bold leading-[0.86] tracking-[-0.03em]"
            style={{ fontSize: "clamp(3rem, 13vw, var(--text-display))" }}
          >
            {t("appName")}
          </h1>
          <p
            className="rise mt-6 max-w-md text-pretty text-grey-500"
            style={{
              fontSize: "var(--text-body)",
              animationDelay: `${STAGGER_MS}ms`,
            }}
          >
            {t("tagline")}
          </p>
        </section>

        {/* Above the fork, not inside either arm of it: a name is what both
            routes need first, and asking for it twice would be worse than
            asking early. */}
        <section
          className="rise md:col-span-5"
          style={{ animationDelay: `${STAGGER_MS}ms` }}
        >
          <FieldLabel>{t("yourName")}</FieldLabel>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder={t("namePlaceholder")}
            autoComplete="nickname"
            className="mt-2 w-full border-b border-ink bg-transparent pb-2 outline-none placeholder:text-grey-300 focus:border-b-2 focus:border-accent focus:pb-[7px]"
            style={{ fontSize: "var(--text-title)" }}
          />
        </section>
      </div>

      {/* A band of its own, spanning the whole field.
          These four numbers first went in the left column, under the tagline,
          which left the name field alone in the right one with nothing to
          balance it — the two halves of the page ended 147px apart. Across the
          full width they stop being a tail on one column and become their own
          layer: statement, then data, then the two ways in. Each is counted
          from the thing it describes, so none of them can quietly go stale. */}
      <dl
        className="rise mt-14 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
        style={{ animationDelay: `${STAGGER_MS * 2}ms` }}
      >
        {stats.map(([key, value]) => (
          <div key={key} className="border-t border-ink pt-2">
            <dt className="label text-grey-500">{t(key)}</dt>
            <dd
              className="numeric mt-2 font-bold leading-none"
              style={{ fontSize: "var(--text-title)" }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div
        className="rise mt-14 grid gap-12 md:mt-auto md:grid-cols-12 md:gap-0 md:pt-16"
        style={{ animationDelay: `${STAGGER_MS * 3}ms` }}
      >
        <Route title={t("routeCreate")} hint={t("routeCreateHint")} className="md:col-span-5 md:pr-8">
          <Button onClick={() => onCreate(trimmedName)} disabled={!named}>
            {t("createRoom")}
          </Button>
        </Route>

        {/* The rule is the separation. It runs the full height of the taller
            column, which is the joining one, and that is the right way round:
            starting a room is one button, getting into one is a choice. */}
        <Route
          title={t("routeJoin")}
          hint={t("routeJoinHint")}
          className="md:col-span-7 md:border-l md:border-ink md:pl-8"
        >
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <div>
              <FieldLabel>{t("roomCode")}</FieldLabel>
              <input
                value={code}
                // Codes get read aloud and typed in a hurry; uppercase as they
                // go so the field always matches what the server expects.
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))
                }
                placeholder={t("codePlaceholder")}
                autoCapitalize="characters"
                autoComplete="off"
                className="numeric mt-2 w-full border-b border-ink bg-transparent pb-2 focus:border-b-2 focus:pb-[7px] tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-grey-300 focus:border-accent"
                style={{ fontSize: "var(--text-title)" }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => onJoin(code.trim(), trimmedName)}
              disabled={!canJoinByCode}
              className="w-auto whitespace-nowrap"
            >
              {t("joinRoom")}
            </Button>
          </div>

          <div className="mt-10">
            <RoomBrowser
              rooms={rooms}
              canJoin={named}
              onJoin={(picked) => onJoin(picked, trimmedName)}
            />
          </div>
        </Route>
      </div>
    </div>
  );
}

/**
 * One of the two ways in.
 *
 * The heading is set in body type over a full rule, a level above the small
 * caps `FieldLabel` used inside it — so a reader can tell the route from the
 * fields that belong to it without either one shouting.
 */
function Route({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h2
        className="border-t border-ink pt-3 font-semibold"
        style={{ fontSize: "var(--text-body)" }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-pretty text-grey-500" style={{ fontSize: "0.9375rem" }}>
        {hint}
      </p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
