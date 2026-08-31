import { randomUUID, randomInt } from "node:crypto";
import type {
  DifficultyId,
  MatchSummary,
  RoomListing,
  MatchConfig,
  Player,
  RevealView,
  RoomPhase,
  RoomState,
  RoundView,
  Track,
} from "@/shared/types";
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "@/shared/difficulty";
import { DEFAULT_PLAYLIST } from "@/data/seeds";
import { makeRng } from "@/shared/rng";
import { DEFAULT_MODE, MODES, type RoundPlan } from "@/shared/modes";
import {
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "@/shared/protocol";
import { buildPool } from "./catalog";

/**
 * Room and Match state, held in this process's memory.
 *
 * That is a deliberate limit, not an oversight: a restart drops every live
 * room, and the app must therefore run as exactly one PM2 instance in fork
 * mode. See docs/adr/0004 and ecosystem.config.cjs.
 */

/** How long a dropped player keeps their seat and score. */
const RECONNECT_GRACE_MS = 30_000;

/** How long the reveal stays up before the next Round opens. */
const REVEAL_MS = 6_000;

/**
 * How long to wait for every client to report buffered audio before starting
 * anyway. One player on bad wifi must not be able to stall the room.
 */
const AUDIO_READY_TIMEOUT_MS = 5_000;

/**
 * How long after the room is ready the clip actually starts.
 *
 * Without this the music began on the exact millisecond the slowest client
 * finished buffering, which made the start of the question a function of the
 * network rather than of the game — and since the next Round's clip is
 * prefetched during the reveal, between rounds that millisecond arrived with no
 * warning at all. The clip is the whole question, so everyone gets the same
 * moment to look up before it is asked.
 *
 * Short on purpose. This is paid ten times a match, and a countdown long enough
 * to be a ceremony is one the room will sit through three hundred seconds of.
 */
const LEAD_IN_MS = 1_200;

/**
 * The same beat, stretched for the first Round of a Match.
 *
 * Pressing start is the one moment in a Match where nobody is watching yet —
 * the room has been picking playlists, somebody is still putting their
 * headphones on. That earns a real count-in, and three whole seconds is what it
 * takes to show a three, a two and a one and still land the music on zero.
 *
 * Every Round after this one gets the short beat instead. By then the room is
 * already looking at the screen, and a ceremony repeated ten times is not a
 * ceremony, it is a wait.
 */
const FIRST_LEAD_IN_MS = 3_000;

/** An idle Room with nobody in it is swept up after this. */
const EMPTY_ROOM_TTL_MS = 60_000;

const DEFAULT_ROUND_COUNT = 10;

/** Answers from the last few Matches, avoided when picking new ones. */
const RECENT_MATCH_MEMORY = 3;

/**
 * Who the unlocks belong to in a shared mode.
 *
 * Player ids are UUIDs, so this can never collide with one.
 */
const TEAM_KEY = "__team__";

type ServerPlayer = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  /** Lets a returning player reclaim their seat after a refresh or a drop. */
  sessionId: string;
  socketId: string | null;
  disconnectedAt: number | null;
};

type SubmittedAnswer = {
  choiceId: string;
  /** ms from Round open to the server receiving this. Server clock only. */
  elapsedMs: number;
  correct: boolean;
  gained: number;
};

type ActiveMatch = {
  rounds: RoundPlan[];
  index: number;
  /** Server time the current Round opened. Zero while still loading. */
  startAt: number;
  deadlineAt: number;
  answers: Map<string, SubmittedAnswer>;
  /**
   * How far the clip has been unlocked on the current Round, keyed by player id
   * — or by TEAM_KEY alone when the mode is shared.
   */
  levels: Map<string, number>;
  /** Wrong titles already tried, keyed the same way as `levels`. */
  tried: Map<string, string[]>;
  ready: Set<string>;
};

export type Room = {
  code: string;
  hostId: string;
  players: Map<string, ServerPlayer>;
  config: MatchConfig;
  phase: RoomPhase;
  match: ActiveMatch | null;
  reveal: RevealView | null;
  /** Track ids used as answers in recent Matches. */
  recentTrackIds: string[];
  /** Pool for the current Match, kept so decoys stay consistent. */
  pool: Track[];
  /** Built up Round by Round; survives the Match so the recap can show it. */
  summary: MatchSummary | null;
  /** Hidden from the public browser. The code still lets people in. */
  locked: boolean;
  emptyAt: number | null;
  timer: NodeJS.Timeout | null;
};

export type RoomEvents = {
  /** Called whenever a Room's public state changed and clients need it. */
  onState: (room: Room) => void;
  /** Called when a Room is torn down. */
  onClosed: (code: string, reason: string) => void;
  /**
   * Called when the public room list may have changed — a room appearing or
   * vanishing, filling up, starting a match, or being locked.
   */
  onListingChanged: () => void;
};

export class RoomError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export class RoomStore {
  private rooms = new Map<string, Room>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(private events: RoomEvents) {}

  /** Starts the periodic sweep for abandoned rooms. */
  start(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), 15_000);
    this.sweeper.unref?.();
  }

  stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    for (const room of this.rooms.values()) this.clearTimer(room);
    this.rooms.clear();
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  size(): number {
    return this.rooms.size;
  }

  // ---------------------------------------------------------------- lifecycle

  createRoom(name: string, socketId: string): { room: Room; player: ServerPlayer } {
    const code = this.freshCode();
    const player = makePlayer(name, socketId);
    const room: Room = {
      code,
      hostId: player.id,
      players: new Map([[player.id, player]]),
      config: {
        mode: DEFAULT_MODE,
        source: { kind: "playlist", playlist: DEFAULT_PLAYLIST },
        difficulty: DEFAULT_DIFFICULTY,
        roundCount: DEFAULT_ROUND_COUNT,
      },
      phase: "lobby",
      match: null,
      reveal: null,
      recentTrackIds: [],
      pool: [],
      summary: null,
      locked: false,
      emptyAt: null,
      timer: null,
    };
    this.rooms.set(code, room);
    this.events.onListingChanged();
    return { room, player };
  }

  joinRoom(
    code: string,
    name: string,
    socketId: string,
    sessionId?: string,
  ): { room: Room; player: ServerPlayer } {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError("no_room", "ไม่พบห้องนี้");

    // A returning player takes back their own seat, score included, even
    // mid-match. This is the whole point of the grace period.
    if (sessionId) {
      const existing = [...room.players.values()].find(
        (p) => p.sessionId === sessionId,
      );
      if (existing) {
        existing.connected = true;
        existing.socketId = socketId;
        existing.disconnectedAt = null;
        existing.name = name;
        room.emptyAt = null;
        return { room, player: existing };
      }
    }

    if (room.players.size >= MAX_PLAYERS) {
      throw new RoomError("room_full", "ห้องเต็มแล้ว");
    }
    // Joining mid-match is allowed but the newcomer starts at zero and simply
    // plays from the next Round; blocking them would be worse than a late start.
    const player = makePlayer(name, socketId);
    room.players.set(player.id, player);
    room.emptyAt = null;
    this.events.onListingChanged();
    return { room, player };
  }

  /**
   * Marks a player disconnected. Their seat survives for the grace period so a
   * refresh or a tunnel through a lift doesn't cost them their score.
   */
  disconnect(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId !== socketId) continue;
        player.connected = false;
        player.socketId = null;
        player.disconnectedAt = Date.now();

        if (room.hostId === player.id) this.transferHost(room);
        if (![...room.players.values()].some((p) => p.connected)) {
          room.emptyAt = Date.now();
        }
        // A round waiting on this player should not keep waiting.
        this.maybeAdvance(room);
        return room;
      }
    }
    return null;
  }

  private transferHost(room: Room): void {
    const next = [...room.players.values()].find(
      (p) => p.connected && p.id !== room.hostId,
    );
    if (next) room.hostId = next.id;
  }

  private freshCode(): string {
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError("no_code", "สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง");
  }

  private sweep(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      let changed = false;

      for (const player of [...room.players.values()]) {
        if (player.connected || player.disconnectedAt === null) continue;
        if (now - player.disconnectedAt < RECONNECT_GRACE_MS) continue;
        room.players.delete(player.id);
        changed = true;
      }

      if (room.players.size === 0) {
        if (room.emptyAt !== null && now - room.emptyAt > EMPTY_ROOM_TTL_MS) {
          this.destroy(room, "empty");
        }
        continue;
      }

      if (room.hostId && !room.players.has(room.hostId)) {
        this.transferHost(room);
        changed = true;
      }
      if (changed) {
        this.maybeAdvance(room);
        this.events.onState(room);
      }
    }
  }

  private destroy(room: Room, reason: string): void {
    this.clearTimer(room);
    this.rooms.delete(room.code);
    this.events.onClosed(room.code, reason);
    this.events.onListingChanged();
  }

  private clearTimer(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  // ------------------------------------------------------------------- config

  setConfig(room: Room, playerId: string, config: MatchConfig): void {
    this.requireHost(room, playerId);
    if (room.phase !== "lobby" && room.phase !== "finished") {
      throw new RoomError("in_match", "เปลี่ยนค่าระหว่างเล่นไม่ได้");
    }
    room.config = config;
    this.events.onState(room);
    this.events.onListingChanged();
  }

  /**
   * Locking hides a Room from the browser without sealing it: the code still
   * works, so a host who wanted a private game can still invite the people they
   * meant to.
   */
  setLocked(room: Room, playerId: string, locked: boolean): void {
    this.requireHost(room, playerId);
    room.locked = locked;
    this.events.onState(room);
    this.events.onListingChanged();
  }

  /** The Rooms a stranger is allowed to see. */
  listRooms(): RoomListing[] {
    const out: RoomListing[] = [];
    for (const room of this.rooms.values()) {
      if (room.locked) continue;
      const playerCount = [...room.players.values()].filter((p) => p.connected).length;
      // An empty room is on its way out; listing it only invites a click that
      // lands nowhere.
      if (playerCount === 0) continue;
      out.push({
        code: room.code,
        mode: room.config.mode,
        playerCount,
        maxPlayers: MAX_PLAYERS,
        phase: room.phase,
        source: room.config.source,
        difficulty: room.config.difficulty,
      });
    }
    // Rooms still waiting first, then the fullest — what a newcomer wants.
    return out.sort((a, b) => {
      const waiting = (r: RoomListing) => (r.phase === "lobby" ? 0 : 1);
      return waiting(a) - waiting(b) || b.playerCount - a.playerCount;
    });
  }

  private requireHost(room: Room, playerId: string): void {
    if (room.hostId !== playerId) {
      throw new RoomError("not_host", "เฉพาะ host เท่านั้น");
    }
  }

  // -------------------------------------------------------------------- match

  async startMatch(room: Room, playerId: string): Promise<void> {
    this.requireHost(room, playerId);
    if (room.phase !== "lobby" && room.phase !== "finished") {
      throw new RoomError("in_match", "กำลังเล่นอยู่แล้ว");
    }

    const rng = makeRng(Date.now() ^ randomInt(2 ** 31));
    const pool = await buildPool(room.config.source, rng);

    const rounds = MODES[room.config.mode].buildRounds({
      pool,
      count: room.config.roundCount,
      difficulty: DIFFICULTIES[room.config.difficulty],
      rng,
      exclude: new Set(room.recentTrackIds),
    });

    if (rounds.length === 0) {
      throw new RoomError("no_tracks", "หาเพลงไม่ได้ ลอง playlist อื่นดู");
    }

    for (const player of room.players.values()) player.score = 0;

    room.pool = pool;
    room.reveal = null;
    room.summary = { rounds: [] };
    room.match = {
      rounds,
      index: 0,
      startAt: 0,
      deadlineAt: 0,
      answers: new Map(),
      levels: new Map(),
      tried: new Map(),
      ready: new Set(),
    };

    // Remember these answers so the next Match in this Room picks other songs.
    room.recentTrackIds = [
      ...rounds.map((r) => r.answer.id),
      ...room.recentTrackIds,
    ].slice(0, DEFAULT_ROUND_COUNT * RECENT_MATCH_MEMORY);

    this.openRound(room);
  }

  /**
   * Puts the Round on screen but does not start its clock: the room sits in
   * `loading` until every connected client says its audio is buffered, or the
   * timeout fires.
   */
  private openRound(room: Room): void {
    const match = room.match;
    if (!match) return;
    this.clearTimer(room);

    match.answers.clear();
    match.levels.clear();
    match.tried.clear();
    match.ready.clear();
    match.startAt = 0;
    match.deadlineAt = 0;
    room.reveal = null;
    room.phase = "loading";

    room.timer = setTimeout(() => this.beginRound(room), AUDIO_READY_TIMEOUT_MS);
    this.events.onState(room);
    this.events.onListingChanged();
  }

  /** A client reports its audio is buffered for the Round it is looking at. */
  markReady(room: Room, playerId: string, index: number): void {
    const match = room.match;
    if (!match || room.phase !== "loading") return;
    if (index !== match.index) return;
    match.ready.add(playerId);

    const waiting = [...room.players.values()].filter((p) => p.connected);
    if (waiting.every((p) => match.ready.has(p.id))) {
      this.beginRound(room);
    } else {
      this.events.onState(room);
    }
  }

  /** Starts the clock. From here the server owns all timing for this Round. */
  private beginRound(room: Room): void {
    const match = room.match;
    if (!match || room.phase !== "loading") return;
    this.clearTimer(room);

    const plan = match.rounds[match.index];
    if (!plan) {
      this.finishMatch(room);
      return;
    }

    // The Round goes live now; the clip does not. `startAt` is the moment the
    // music begins, and every clock in the game — the countdown, the score's
    // elapsed time, the client's playback — is measured from it, so the lead-in
    // costs the players none of their answer window.
    const leadInMs = match.index === 0 ? FIRST_LEAD_IN_MS : LEAD_IN_MS;
    match.startAt = Date.now() + leadInMs;
    match.deadlineAt = match.startAt + plan.answerWindowMs;
    room.phase = "playing";

    room.timer = setTimeout(
      () => this.closeRound(room),
      leadInMs + plan.answerWindowMs,
    );
    this.events.onState(room);
  }

  /** Who the current Round's unlocks and score belong to. */
  private ownerKey(room: Room, playerId: string): string {
    return MODES[room.config.mode].shared ? TEAM_KEY : playerId;
  }

  /**
   * Spend a level to hear more of the Preview.
   *
   * Costs nothing but points, and the points are charged when the guess lands:
   * the level a player is standing on is the tier they will be paid.
   */
  unlock(room: Room, playerId: string, index: number): void {
    const match = room.match;
    if (!match || room.phase !== "playing") return;
    if (index !== match.index) return;

    const plan = match.rounds[match.index];
    if (!plan || plan.stagesMs.length === 0) return;

    const key = this.ownerKey(room, playerId);
    // Somebody already finished for this owner; there is nothing left to hear.
    if (this.isDone(room, match, playerId)) return;

    const last = plan.stagesMs.length - 1;
    const current = match.levels.get(key) ?? 0;
    if (current >= last) return;

    match.levels.set(key, current + 1);
    this.events.onState(room);
  }

  /** Whether this player's Round is already settled. */
  private isDone(room: Room, match: ActiveMatch, playerId: string): boolean {
    return MODES[room.config.mode].shared
      ? match.answers.size > 0
      : match.answers.has(playerId);
  }

  /**
   * Records a guess and lets the Game Mode decide what it was worth.
   *
   * Nothing here knows what mode is running. It asks `judge` whether the guess
   * ends the Round for whoever made it, and `shared` whether "whoever" means
   * one player or the whole Room. Returns what happened so the caller can tell
   * the guesser — privately, because in the competitive mode a wrong guess is
   * nobody else's business.
   */
  submitAnswer(
    room: Room,
    playerId: string,
    index: number,
    guess: string,
  ): { correct: boolean; final: boolean; level: number } | null {
    const match = room.match;
    if (!match || room.phase !== "playing") return null;
    if (index !== match.index) return null;
    // Nothing has been heard yet. Refusing here is not only fair — the elapsed
    // time would be negative, and `scoreAnswer` clamps that to the maximum
    // bonus, so a blind guess during the lead-in would have paid the best score
    // in the game.
    if (Date.now() < match.startAt) return null;

    const mode = MODES[room.config.mode];
    const plan = match.rounds[match.index];
    if (!plan) return null;
    // A Quiz guess names one of the options; a typed one is free text the mode
    // grades itself.
    if (!mode.typed && !plan.choices.some((c) => c.id === guess)) return null;

    if (this.isDone(room, match, playerId)) return null;

    const key = this.ownerKey(room, playerId);
    const tried = match.tried.get(key) ?? [];
    // Sending a title that has already failed is a mis-tap or a teammate who
    // did not look; either way it must not cost a rung.
    if (tried.some((t) => t.toLowerCase() === guess.toLowerCase())) return null;

    const level = match.levels.get(key) ?? 0;

    // Server clock, server arithmetic. The client's countdown is decoration.
    const elapsedMs = Date.now() - match.startAt;
    const judged = mode.judge({ plan, guess, elapsedMs, level });

    match.levels.set(key, judged.level);
    if (!judged.correct) match.tried.set(key, [...tried, guess]);

    if (judged.final) {
      const record = {
        choiceId: guess,
        elapsedMs,
        correct: judged.correct,
        gained: judged.gained,
      };
      // A shared mode scores the Room, not the guesser: everyone connected ends
      // the Round with the same result and the same points.
      const scored = mode.shared
        ? [...room.players.values()].filter((p) => p.connected)
        : [room.players.get(playerId)].filter((p) => p !== undefined);
      for (const player of scored) {
        match.answers.set(player.id, record);
        player.score += judged.gained;
      }
    }

    this.maybeAdvance(room);
    if (room.phase === "playing") this.events.onState(room);
    return { correct: judged.correct, final: judged.final, level: judged.level };
  }

  /** Ends the Round early once nobody the room is waiting on is left. */
  private maybeAdvance(room: Room): void {
    const match = room.match;
    if (!match) return;

    if (room.phase === "loading") {
      const waiting = [...room.players.values()].filter((p) => p.connected);
      if (waiting.length > 0 && waiting.every((p) => match.ready.has(p.id))) {
        this.beginRound(room);
      }
      return;
    }

    if (room.phase !== "playing") return;
    // One shared answer settles the Round, including for anyone who joined
    // after it opened and so was never able to guess.
    if (MODES[room.config.mode].shared && match.answers.size > 0) {
      this.closeRound(room);
      return;
    }
    const active = [...room.players.values()].filter((p) => p.connected);
    if (active.length === 0) return;
    if (active.every((p) => match.answers.has(p.id))) this.closeRound(room);
  }

  private closeRound(room: Room): void {
    const match = room.match;
    if (!match || room.phase !== "playing") return;
    this.clearTimer(room);

    const plan = match.rounds[match.index];
    if (!plan) {
      this.finishMatch(room);
      return;
    }

    const next = match.rounds[match.index + 1];
    room.reveal = {
      index: match.index,
      correctChoiceId: plan.answer.id,
      track: plan.answer,
      nextPreviewUrl: next ? next.answer.previewUrl : null,
      results: [...room.players.values()].map((p) => {
        const a = match.answers.get(p.id);
        return {
          playerId: p.id,
          choiceId: a?.choiceId ?? null,
          correct: a?.correct ?? false,
          gained: a?.gained ?? 0,
          totalScore: p.score,
        };
      }),
    };
    room.phase = "reveal";

    room.summary?.rounds.push({
      index: match.index,
      track: plan.answer,
      results: room.reveal.results.map((r) => ({
        playerId: r.playerId,
        correct: r.correct,
        gained: r.gained,
      })),
    });

    room.timer = setTimeout(() => {
      if (!room.match) return;
      room.match.index += 1;
      if (room.match.index >= room.match.rounds.length) this.finishMatch(room);
      else this.openRound(room);
    }, REVEAL_MS);

    this.events.onState(room);
  }

  private finishMatch(room: Room): void {
    this.clearTimer(room);
    room.phase = "finished";
    room.match = null;
    this.events.onState(room);
    this.events.onListingChanged();
  }

  /** Host sends everyone back to the lobby after a Match. */
  returnToLobby(room: Room, playerId: string): void {
    this.requireHost(room, playerId);
    this.clearTimer(room);
    room.phase = "lobby";
    room.match = null;
    room.reveal = null;
    room.summary = null;
    this.events.onState(room);
    this.events.onListingChanged();
  }
}

function makePlayer(name: string, socketId: string): ServerPlayer {
  return {
    id: randomUUID(),
    name,
    score: 0,
    connected: true,
    sessionId: randomUUID(),
    socketId,
    disconnectedAt: null,
  };
}

/** Strip a Room down to what clients are allowed to see. */
export function toRoomState(room: Room): RoomState {
  const players: Player[] = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
  }));

  let round: RoundView | null = null;
  const match = room.match;
  if (match) {
    const plan = match.rounds[match.index];
    if (plan) {
      round = {
        index: match.index,
        total: match.rounds.length,
        // Note what is absent: which choice is correct. The client is never
        // told the answer before the reveal.
        choices: plan.choices,
        clipMs: plan.clipMs,
        answerWindowMs: plan.answerWindowMs,
        stagesMs: plan.stagesMs,
        levels: [...room.players.values()].map((p) => ({
          playerId: p.id,
          level:
            match.levels.get(
              MODES[room.config.mode].shared ? TEAM_KEY : p.id,
            ) ?? 0,
        })),
        tried: MODES[room.config.mode].shared
          ? (match.tried.get(TEAM_KEY) ?? [])
          : [],
        deadlineAt: match.deadlineAt,
        startAt: match.startAt,
        previewUrl: plan.answer.previewUrl,
      };
    }
  }

  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players,
    config: room.config,
    round,
    reveal: room.reveal,
    locked: room.locked,
    answeredPlayerIds: match ? [...match.answers.keys()] : [],
    readyPlayerIds: match ? [...match.ready] : [],
    // Only at the end: it grows all match long and every state change is
    // broadcast to every player.
    summary: room.phase === "finished" ? room.summary : null,
  };
}

export const ROOM_TUNING = {
  RECONNECT_GRACE_MS,
  REVEAL_MS,
  AUDIO_READY_TIMEOUT_MS,
  LEAD_IN_MS,
  FIRST_LEAD_IN_MS,
  EMPTY_ROOM_TTL_MS,
  DEFAULT_ROUND_COUNT,
};

export type { ServerPlayer, DifficultyId };
