import type { PlaylistGroup, PlaylistId } from "@/shared/types";
import { THAI_ARTISTS } from "./thai";
import { THAI_90S_ARTISTS } from "./thai90s";
import { THAI_2000S_ARTISTS } from "./thai2000s";
import { THAI_2020S_ARTISTS } from "./thai2020s";
import { INTL_ARTISTS } from "./intl";
import { KPOP_ARTISTS } from "./kpop";
import { HITS_TRACK_IDS } from "./hits";

/**
 * Where a Playlist's Tracks come from.
 *
 * `chart` reads Apple's daily most-played feed for a storefront, so those
 * playlists refresh themselves without anyone editing a list. `artists` draws
 * from a curated seed list, optionally narrowed to a release-year window, which
 * is what makes an era playlist possible at all.
 */
export type PlaylistSource =
  | {
      kind: "chart";
      country: string;
      /**
       * A storefront chart is "what people here play", not "songs in this
       * language" — the Thai chart is full of K-pop and Western pop. Naming a
       * script narrows it back to the playlist's own language.
       */
      script?: "thai" | "hangul";
    }
  | {
      /** An exact, hand-picked set of recordings, named by iTunes track id. */
      kind: "tracks";
      country: string;
      trackIds: readonly string[];
    }
  | {
      kind: "artists";
      country: string;
      artists: readonly string[];
      /** Inclusive release-year bounds. Omitted means no filtering. */
      yearFrom?: number;
      yearTo?: number;
    };

export type PlaylistDef = {
  id: PlaylistId;
  /** Only for arranging the picker; it is not part of choosing one. */
  group: PlaylistGroup;
  source: PlaylistSource;
};

export const PLAYLISTS: Record<PlaylistId, PlaylistDef> = {
  "thai-now": {
    id: "thai-now",
    group: "thai",
    source: { kind: "chart", country: "th", script: "thai" },
  },
  "thai-buzz": {
    id: "thai-buzz",
    group: "thai",
    // A Spotify playlist someone exported, resolved to iTunes ids once by
    // scripts/resolve-csv-playlist.ts. See src/data/seeds/hits-source.csv for
    // what was asked for and src/data/seeds/hits.ts for what was found.
    source: { kind: "tracks", country: "TH", trackIds: HITS_TRACK_IDS },
  },
  "thai-classic": {
    id: "thai-classic",
    group: "thai",
    source: { kind: "artists", country: "TH", artists: THAI_ARTISTS },
  },
  "thai-90s": {
    id: "thai-90s",
    group: "thai",
    source: {
      kind: "artists",
      country: "TH",
      artists: THAI_90S_ARTISTS,
      yearFrom: 1988,
      yearTo: 2005,
    },
  },
  "thai-2000s": {
    id: "thai-2000s",
    group: "thai",
    source: {
      kind: "artists",
      country: "TH",
      artists: THAI_2000S_ARTISTS,
      yearFrom: 2000,
      yearTo: 2012,
    },
  },
  "thai-2020s": {
    id: "thai-2020s",
    group: "thai",
    source: {
      kind: "artists",
      country: "TH",
      artists: THAI_2020S_ARTISTS,
      yearFrom: 2020,
    },
  },

  "intl-now": {
    id: "intl-now",
    group: "intl",
    source: { kind: "chart", country: "us" },
  },
  "intl-classic": {
    id: "intl-classic",
    group: "intl",
    source: { kind: "artists", country: "TH", artists: INTL_ARTISTS },
  },

  "kpop-now": {
    id: "kpop-now",
    group: "kpop",
    source: { kind: "chart", country: "kr", script: "hangul" },
  },
  "kpop-classic": {
    id: "kpop-classic",
    group: "kpop",
    source: { kind: "artists", country: "TH", artists: KPOP_ARTISTS },
  },
};

/** Display order within each group, and the order of the groups themselves. */
export const PLAYLIST_GROUPS: Array<{ group: PlaylistGroup; ids: PlaylistId[] }> = [
  {
    group: "thai",
    ids: [
      "thai-now",
      "thai-buzz",
      "thai-classic",
      "thai-2020s",
      "thai-2000s",
      "thai-90s",
    ],
  },
  { group: "intl", ids: ["intl-now", "intl-classic"] },
  { group: "kpop", ids: ["kpop-now", "kpop-classic"] },
];

export const PLAYLIST_IDS = PLAYLIST_GROUPS.flatMap((g) => g.ids);

export const DEFAULT_PLAYLIST: PlaylistId = "thai-classic";
