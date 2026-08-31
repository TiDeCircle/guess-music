"use client";

import type { RoomListing } from "@/shared/types";
import { PLAYLISTS } from "@/data/seeds";
import { useLang, type StringKey } from "@/client/i18n";
import { FieldLabel } from "./Shell";

/**
 * The rooms anyone can walk into.
 *
 * No player names here on purpose: the site is public, and a name is not what
 * anyone picks a room by — the code, how full it is, and what it is playing
 * are. A host who wants privacy locks the room, which takes it off this list
 * while leaving the code working.
 */
export function RoomBrowser({
  rooms,
  canJoin,
  onJoin,
}: {
  rooms: RoomListing[];
  /** False until a name is typed, since joining needs one. */
  canJoin: boolean;
  onJoin: (code: string) => void;
}) {
  const { t } = useLang();

  return (
    <section>
      <FieldLabel>{t("openRooms")}</FieldLabel>

      {rooms.length === 0 ? (
        // A single grey line under a rule reads as something that failed to
        // load. A bounded, empty band reads as a room list with no rooms in it.
        <p className="label mt-2 flex min-h-24 items-center border-b border-grey-300 text-pretty text-grey-500">
          {t("noOpenRooms")}
        </p>
      ) : (
        <ul className="mt-2">
          {rooms.map((room) => {
            const full = room.playerCount >= room.maxPlayers;
            const playing = room.phase !== "lobby";
            const label =
              room.source.kind === "artist"
                ? room.source.artist
                : t(`playlist.${room.source.playlist}` as StringKey);

            return (
              <li
                key={room.code}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-grey-300 py-3"
              >
                <span className="numeric font-semibold tracking-[0.1em]">
                  {room.code}
                </span>

                <span className="min-w-0">
                  <span className="block truncate" style={{ fontSize: "var(--text-body)" }}>
                    {label}
                  </span>
                  <span className="label block text-grey-500">
                    {t(`mode.${room.mode}` as StringKey)} ·{" "}
                    {/* The count changes under the reader as people join, and a
                        proportional 1 is narrower than a 4. */}
                    <span className="numeric">
                      {room.playerCount}/{room.maxPlayers}
                    </span>{" "}
                    · {playing ? t("inMatch") : t("waiting")}
                  </span>
                </span>

                <button
                  type="button"
                  disabled={!canJoin || full}
                  onClick={() => onJoin(room.code)}
                  title={!canJoin ? t("needNameFirst") : undefined}
                  className="press label border border-ink px-4 py-2 enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:border-grey-300 disabled:text-grey-300"
                >
                  {full ? t("roomFull") : t("join")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rooms.length > 0 && !canJoin && (
        <p className="label mt-3 text-grey-500">{t("needNameFirst")}</p>
      )}
    </section>
  );
}
