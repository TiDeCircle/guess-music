import { z } from "zod";
import type { RoomState } from "./types";

/**
 * The wire contract. Everything arriving from a client is parsed with these
 * schemas before it touches room state — a socket payload is attacker-controlled
 * input, not a typed object, whatever TypeScript believes.
 */

/**
 * Room codes skip O/0 and I/1: these get read aloud across a room and typed by
 * someone squinting at a phone.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

export const MAX_PLAYERS = 8;
export const NAME_MAX_LENGTH = 16;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), "bad room code");

export const playerNameSchema = z
  .string()
  .trim()
  // Control characters would let a name wreck the layout or impersonate UI text.
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, "bad name")
  .min(1)
  .max(NAME_MAX_LENGTH);

export const playlistSchema = z.enum([
  "thai-now",
  "thai-classic",
  "thai-90s",
  "thai-2000s",
  "thai-2020s",
  "intl-now",
  "intl-classic",
  "kpop-now",
  "kpop-classic",
]);
export const difficultySchema = z.enum(["easy", "medium", "hard", "extreme"]);

export const createRoomSchema = z.object({ name: playerNameSchema });

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  name: playerNameSchema,
  /** Set when returning after a drop, to reclaim the same seat and score. */
  sessionId: z.string().min(8).max(64).optional(),
});

/**
 * The artist branch carries a name, not a free search term: the server checks
 * it against the shipped artist list before it reaches iTunes.
 */
export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("playlist"), playlist: playlistSchema }),
  z.object({ kind: z.literal("artist"), artist: z.string().min(1).max(64) }),
]);

export const configSchema = z.object({
  source: sourceSchema,
  difficulty: difficultySchema,
  roundCount: z.number().int().min(3).max(20),
});

export const readySchema = z.object({ index: z.number().int().min(0) });

export const answerSchema = z.object({
  index: z.number().int().min(0),
  choiceId: z.string().min(1).max(64),
});

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type JoinResult = {
  code: string;
  playerId: string;
  sessionId: string;
};

export interface ClientToServerEvents {
  "room:create": (
    payload: unknown,
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  "room:join": (payload: unknown, ack: (res: Ack<JoinResult>) => void) => void;
  "room:config": (payload: unknown) => void;
  "match:start": () => void;
  /** Client reports its audio is buffered for this Round. */
  "round:ready": (payload: unknown) => void;
  "round:answer": (payload: unknown) => void;
  /**
   * Clock sync. The client measures round-trip time and derives how far its
   * Date.now() sits from the server's, so a countdown to a server deadline is
   * accurate without streaming a tick every second.
   */
  "clock:sync": (ack: (serverNow: number) => void) => void;
}

export interface ServerToClientEvents {
  /**
   * One full snapshot, every time anything changes. Rooms hold at most eight
   * players and the state is a few kilobytes, so shipping the whole thing costs
   * less than the class of bugs that incremental patches invite.
   */
  "room:state": (state: RoomState) => void;
  "room:closed": (reason: string) => void;
  "room:error": (error: { code: string; message: string }) => void;
}
