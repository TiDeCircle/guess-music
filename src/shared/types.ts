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
  | "thai-luk-thung"
  | "thai-sad"
  | "thai-2019-2020"
  | "intl-now"
  | "intl-classic"
  | "intl-tiktok"
  | "kpop-now"
  | "kpop-classic";

/** Only used to arrange the picker; players choose a Playlist, not a group. */
export type PlaylistGroup = "thai" | "intl" | "kpop";

export type DifficultyId = "easy" | "medium" | "hard" | "extreme";

/**
 * The Game Modes a Room can play.
 *
 * `quiz` is one clip and one answer chosen off the screen. Both Heardle modes
 * replace that with a clip you unlock a step at a time and an answer you type.
 * The split between them is social, not mechanical: `heardle` gives every
 * player their own ladder and score, `heardle-coop` gives the whole Room one of
 * each.
 */
export type GameModeId = "quiz" | "heardle" | "heardle-coop";

/** One of the four options shown in a Round. */
/**
 * One option on the Quiz board.
 *
 * A title and nothing else. The artist used to ride along and be printed under
 * the title, which quietly decided most rounds: on easy and medium every decoy
 * is by a different act, so recognising a voice picked the answer out without
 * knowing the song — in a game whose whole question is the song. It is not on
 * the wire at all now, so it cannot be read out of the network tab either.
 */
export type Choice = {
  id: string;
  title: string;
};

export type Player = {
  id: string;
  name: string;
  /** Total across the current Match. */
  score: number;
  /** Consecutive correct answers right now. Resets to 0 on a wrong or missed one. */
  streak: number;
  connected: boolean;
  /** Host has silenced this Player's reaction stamps. Visible to everyone. */
  muted: boolean;
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
  /**
   * The options on screen. Empty in a typed mode — which is the strongest
   * version of the promise the Quiz rounds only approximate: with no options
   * sent, the answer is not on the wire at all before the reveal.
   */
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
   * Heardle: how much of the Preview each unlock level hands over. Empty in
   * Quiz, whose clip is fixed for the whole Round.
   */
  stagesMs: number[];
  /**
   * How far each player has unlocked the clip. In a shared mode every entry
   * carries the Room's one level.
   *
   * Public on purpose: how much music someone has spent is not a hint about
   * what the song is, and watching a rival still sitting on one second is the
   * best part of playing this against people.
   */
  levels: Array<{ playerId: string; level: number }>;
  /**
   * Titles the Room has already tried and had rejected. Filled only in a shared
   * mode, where the ladder is everyone's: without it a teammate would spend a
   * rung repeating a guess that has already failed.
   *
   * In a competitive mode this stays empty — your own wrong guesses are yours,
   * and the client remembers them without telling anybody.
   */
  tried: string[];
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
    /** A choice id in Quiz, the typed title in Heardle. Null if they never answered. */
    choiceId: string | null;
    correct: boolean;
    gained: number;
    totalScore: number;
    /** ms from the Round opening to the answer landing. Null if none came. */
    elapsedMs: number | null;
    /** Heardle: how far the clip had been unlocked when the answer landed. */
    level: number;
    /**
     * Who actually guessed. Only differs from `playerId` in a shared mode,
     * where one person's answer is written onto everybody's row — without this
     * a co-op reveal is one result wearing eight names and no way to tell whose
     * it was.
     */
    byPlayerId: string | null;
    /**
     * Every title they tried and had rejected, in the order they tried them.
     *
     * A Heardle player who guessed twice and ran out of time has no final
     * answer at all, so without this the reveal said they never answered — and
     * "what did you put?" is the first thing the room asks. Shared modes carry
     * the Room's list here, since the guesses were the Room's — and each one
     * names whoever typed it, which is the only way a co-op reveal can say who
     * spent the rung.
     */
    tried: Array<{ text: string; byPlayerId: string }>;
  }>;
};

/** One Round as it looked once it was over, kept for the end-of-Match recap. */
export type MatchSummaryRound = {
  index: number;
  track: Track;
  results: Array<{
    playerId: string;
    correct: boolean;
    gained: number;
    elapsedMs?: number | null;
    level?: number;
    byPlayerId?: string | null;
  }>;
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
