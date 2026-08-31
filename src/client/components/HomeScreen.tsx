"use client";

import { useState } from "react";
import type { RoomListing } from "@/shared/types";
import { useLang } from "@/client/i18n";
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "@/shared/protocol";
import { Button } from "./Button";
import { FieldLabel } from "./Shell";
import { RoomBrowser } from "./RoomBrowser";

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
  const { t } = useLang();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !busy;
  const canJoin = canCreate && code.trim().length === ROOM_CODE_LENGTH;

  return (
    <div className="grid gap-12 md:grid-cols-12 md:gap-8">
      <section className="md:col-span-7">
        {/* The one place the design shouts. A Swiss poster earns its whitespace
            by putting a single large statement against it. */}
        <h1
          className="font-bold leading-[0.86] tracking-[-0.03em]"
          style={{ fontSize: "clamp(3rem, 13vw, var(--text-display))" }}
        >
          {t("appName")}
        </h1>
        <p className="mt-6 max-w-md text-grey-500" style={{ fontSize: "var(--text-body)" }}>
          {t("tagline")}
        </p>
      </section>

      <section className="flex flex-col gap-8 md:col-span-5">
        <div>
          <FieldLabel>{t("yourName")}</FieldLabel>
          <input
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
              // Codes get read aloud and typed in a hurry; uppercase as they go
              // so the field always matches what the server expects.
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))}
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

      {/* Below the fold on a phone, which is right: someone arriving with a code
          from a friend should not have to scroll past strangers' rooms. */}
      <section className="md:col-span-12">
        <RoomBrowser
          rooms={rooms}
          canJoin={trimmedName.length > 0 && !busy}
          onJoin={(code) => onJoin(code, trimmedName)}
        />
      </section>
    </div>
  );
}