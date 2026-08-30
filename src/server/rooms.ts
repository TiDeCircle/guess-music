import { randomUUID, randomInt } from "node:crypto";
import type {
  DifficultyId,
  MatchSummary,
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
import { scoreAnswer } from "@/shared/scoring";
import { makeRng } from "@/shared/rng";
import { quizMode, type RoundPlan } from "@/shared/modes";
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

/** An idle Room with nobody in it is swept up after this. */
const EMPTY_ROOM_TTL_MS = 60_000;

const DEFAULT_ROUND_COUNT = 10;

/** Answers from the last few Matches, avoided when picking new ones. */
const RECENT_MATCH_MEMORY = 3;

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
  emptyAt: number | null;
  timer: NodeJS.Timeout | null;
};

export type RoomEvents = {
  /** Called whenever a Room's public state changed and clients need it. */
  onState: (room: Room) => void;
  /** Called when a Room is torn down. */
  onClosed: (code: string, reason: string) => void;
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
        playlist: DEFAULT_PLAYLIST,
        difficulty: DEFAULT_DIFFICULTY,
        roundCount: DEFAULT_ROUND_COUNT,
      },
      phase: "lobby",
      match: null,
      reveal: null,
      recentTrackIds: [],
      pool: [],
      summary: null,
      emptyAt: null,
      timer: null,
    };
    this.rooms.set(code, room);
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
    const pool = await buildPool(room.config.playlist, rng);

    const rounds = quizMode.buildRounds({
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
    match.ready.clear();
    match.startAt = 0;
    match.deadlineAt = 0;
    room.reveal = null;
    room.phase = "loading";

    room.timer = setTimeout(() => this.beginRound(room), AUDIO_READY_TIMEOUT_MS);
    this.events.onState(room);
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

    match.startAt = Date.now();
    match.deadlineAt = match.startAt + plan.answerWindowMs;
    room.phase = "playing";

    room.timer = setTimeout(() => this.closeRound(room), plan.answerWindowMs);
    this.events.onState(room);
  }

  /**
   * Records an answer. One per player per Round, final — changing your mind is
   * not allowed, which is what makes the speed bonus mean anything.
   */
  submitAnswer(
    room: Room,
    playerId: string,
    index: number,
    choiceId: string,
  ): void {
    const match = room.match;
    if (!match || room.phase !== "playing") return;
    if (index !== match.index) return;
    if (match.answers.has(playerId)) return;

    const plan = match.rounds[match.index];
    if (!plan) return;
    if (!plan.choices.some((c) => c.id === choiceId)) return;

    // Server clock, server arithmetic. The client's countdown is decoration.
    const elapsedMs = Date.now() - match.startAt;
    const correct = choiceId === plan.answer.id;
    const gained = scoreAnswer({
      correct,
      elapsedMs,
      windowMs: plan.answerWindowMs,
      multiplier: plan.multiplier,
    });

    match.answers.set(playerId, { choiceId, elapsedMs, correct, gained });

    const player = room.players.get(playerId);
    if (player) player.score += gained;

    this.maybeAdvance(room);
    if (room.phase === "playing") this.events.onState(room);
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
  EMPTY_ROOM_TTL_MS,
  DEFAULT_ROUND_COUNT,
};

export type { ServerPlayer, DifficultyId };
