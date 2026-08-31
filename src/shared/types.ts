/**
 * Core domain types. See CONTEXT.md for what each term means — the names here
 * are the ones the glossary defines, and they should not drift apart.
 */

/** One song as iTunes describes it. We never host audio ourselves. */
export type Track = {
  /** iTunes trackId, stringified. */
  id: string;
  title: string;
  artist: string;
  /** iTunes artistId — used to tell "same artist" decoys from "different". */
  artistId: number;
  /** Album art, already upgraded past the 100x100 the API hands back. */
  artworkUrl: string;
  /** The 30-second Preview. Never a full song. */
  previewUrl: string;
  /** Release year, used to narrow a Playlist to an era. 0 when unknown. */
  year: number;
};

/**
 * The Playlists a Host can pick from. A Playlist decides which songs a Match
 * draws on — an era, a curated set, or a live chart.
 */
export type PlaylistId =
  | "thai-now"
  | "thai-buzz"
  | "thai-classic"
  | "thai-90s"
  | "thai-2000s"
  | "thai-2020s"
  | "intl-now"
  | "intl-classic"
  | "kpop-now"
  | "kpop-classic";

/** Only used to arrange the picker; players choose a Playlist, not a group. */
export type PlaylistGroup = "thai" | "intl" | "kpop";

export type DifficultyId = "easy" | "medium" | "hard" | "extreme";

/**
 * The Game Modes a Room can play.
 *
 * `quiz` is one clip and one final answer. Both Heardle modes replace that with
 * a clip that keeps growing and guesses that can be spent wrong — the split
 * between them is social, not mechanical: `heardle` gives every player their own
 * attempts and score, `heardle-coop` gives the whole Room one of each.
 */
export type GameModeId = "quiz" | "heardle" | "heardle-coop";

/** One of the four options shown in a Round. */
export type Choice = {
  id: string;
  title: string;
  artist: string;
};

export type Player = {
  id: string;
  name: string;
  /** Total across the current Match. */
  score: number;
  connected: boolean;
};

/**
 * Where a Room is in its lifecycle.
 *
 * `loading` exists because a Round must not start its clock until every client
 * has the audio buffered — otherwise the slowest connection is punished for
 * something that isn't the player's fault.
 */
export type RoomPhase = "lobby" | "loading" | "playing" | "reveal" | "finished";

/**
 * Where a Match draws its songs from.
 *
 * A Playlist is a curated set; an Artist turns the game into "which song of
 * theirs is this?", where every wrong option is by the same act and the voice
 * gives nothing away.
 */
export type SongSource =
  | { kind: "playlist"; playlist: PlaylistId }
  | { kind: "artist"; artist: string };

export type MatchConfig = {
  mode: GameModeId;
  source: SongSource;
  difficulty: DifficultyId;
  roundCount: number;
};

/** What a Round looks like from the client's side — no answer in here. */
export type RoundView = {
  index: number;
  total: number;
  choices: Choice[];
  /** How long the Preview stays audible. */
  clipMs: number;
  /**
   * How long answers are accepted. Sent separately from the deadline because
   * the client draws the round's shape during `loading`, before the server has
   * started the clock and while the deadline is therefore still unset.
   */
  answerWindowMs: number;
  /**
   * Server clock, in ms since epoch. The client counts down to this on its own
   * so the timer runs at 60fps without a packet per second; it corrects for
   * clock skew using the offset measured at join.
   */
  deadlineAt: number;
  startAt: number;
  previewUrl: string;
  /**
   * Heardle: the ms marks where the score tier drops, last one being where the
   * music stops. Empty in Quiz, which has a single tier and a linear bonus.
   */
  stagesMs: number[];
  /**
   * Options struck out for the whole Room by a wrong guess. Only a shared mode
   * fills this — in a competitive one a strike is private to whoever spent it,
   * and broadcasting it would hand everyone else a free elimination.
   */
  strikes: string[];
};

/** What everyone sees once the Round closes. */
export type RevealView = {
  index: number;
  correctChoiceId: string;
  track: Track;
  /**
   * The next Round's Preview, so clients can buffer it while the reveal is on
   * screen. Null on the last Round.
   */
  nextPreviewUrl: string | null;
  /** Per player: what they picked and what it earned. */
  results: Array<{
    playerId: string;
    choiceId: string | null;
    correct: boolean;
    gained: number;
    totalScore: number;
  }>;
};

/** One Round as it looked once it was over, kept for the end-of-Match recap. */
export type MatchSummaryRound = {
  index: number;
  track: Track;
  results: Array<{ playerId: string; correct: boolean; gained: number }>;
};

/**
 * Everything a Match played, assembled as it goes.
 *
 * Sent only once the Match is finished: it grows with every Round, and the
 * whole Room state is broadcast on every change, so shipping it throughout
 * would cost bandwidth on data nobody can act on yet.
 */
export type MatchSummary = {
  rounds: MatchSummaryRound[];
};

/**
 * A Room as it appears in the browser on the home screen.
 *
 * Deliberately without player names: the site is public, and a name is not what
 * anyone picks a room by. The code, how full it is, and what it is playing are.
 */
export type RoomListing = {
  code: string;
  mode: GameModeId;
  playerCount: number;
  maxPlayers: number;
  phase: RoomPhase;
  source: SongSource;
  difficulty: DifficultyId;
};

export type RoomState = {
  code: string;
  phase: RoomPhase;
  hostId: string;
  players: Player[];
  config: MatchConfig;
  /** Present while phase is playing/reveal/finished. */
  round: RoundView | null;
  reveal: RevealView | null;
  /** Which players have already answered the current Round. */
  answeredPlayerIds: string[];
  /** Which players have their audio buffered, while phase is loading. */
  readyPlayerIds: string[];
  /** The songs just played. Present only while phase is finished. */
  summary: MatchSummary | null;
  /**
   * A locked Room is kept out of the public browser. The code still works, so
   * it is "unlisted" rather than sealed — the host can still invite whoever
   * they meant to invite.
   */
  locked: boolean;
};
