"use client";

import { useEffect, useRef, useState } from "react";
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
  const canCreate = trimmedName.length > 0 && !busy;
  const canJoin = canCreate && code.trim().length === ROOM_CODE_LENGTH;

  /**
   * Put the caret in the name field, but only where there is a mouse.
   *
   * Every control on this screen is disabled until a name exists, so landing
   * with the caret already there says what to do without a line of copy saying
   * it. On a phone the same autofocus throws up a keyboard that covers the page
   * before anyone has read it, which is why this asks about the pointer first.
   */
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) nameRef.current?.focus();
  }, []);

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

          {/* What used to be half a page of nothing. A Swiss poster can carry
              empty space, but not empty space with no shape to it — and these
              are the four numbers a first-time visitor is actually asking
              about. Each is counted from the data it describes, so none of them
              can quietly go out of date. */}
          <dl
            className="rise mt-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
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
        </section>

        <section
          className="rise flex flex-col gap-8 md:col-span-5"
          style={{ animationDelay: `${STAGGER_MS}ms` }}
        >
          <div>
            <FieldLabel>{t("yourName")}</FieldLabel>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX_LENGTH}
              placeholder={t("namePlaceholder")}
              autoComplete="nickname"
              className="mt-2 w-full border-b border-ink bg-transparent pb-2 outline-none placeholder:text-grey-300 focus:border-accent"
              style={{ fontSize: "var(--text-title)" }}
            />
          </div>

          <Button onClick={() => onCreate(trimmedName)} disabled={!canCreate}>
            {t("createRoom")}
          </Button>

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
                className="numeric mt-2 w-full border-b border-ink bg-transparent pb-2 tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-grey-300 focus:border-accent"
                style={{ fontSize: "var(--text-title)" }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => onJoin(code.trim(), trimmedName)}
              disabled={!canJoin}
              className="w-auto whitespace-nowrap"
            >
              {t("joinRoom")}
            </Button>
          </div>
        </section>
      </div>

      {/* Below the fold on a phone, which is right: someone arriving with a code
          from a friend should not have to scroll past strangers' rooms. On a
          desktop it sinks to the foot of the field rather than trailing off
          under the form, so the composition has a bottom edge. */}
      <section
        className="rise mt-12 md:mt-auto md:pt-16"
        style={{ animationDelay: `${STAGGER_MS * 3}ms` }}
      >
        <RoomBrowser
          rooms={rooms}
          canJoin={trimmedName.length > 0 && !busy}
          onJoin={(code) => onJoin(code, trimmedName)}
        />
      </section>
    </div>
  );
}
