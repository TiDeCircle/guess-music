"use client";

import type { Player } from "@/shared/types";

/**
 * What a Round looks like from outside it.
 *
 * Both of these are things the play screen already knew and threw away: the
 * clock knew it was nearly out and said it in the same weight it had used all
 * round, and the player strip knew how many people were still thinking but only
 * ever showed it as a wall of cells you had to count yourself.
 *
 * They live here rather than in the components because they are arithmetic, and
 * arithmetic is the part worth pinning down in a test.
 */

/**
 * How long before the deadline the clock starts saying so.
 *
 * Five seconds is about the point where a player stops reading the number and
 * starts reacting to it, which is exactly when the number should stop being a
 * number and become a warning.
 */
export const FINAL_STRETCH_MS = 5_000;

/**
 * True once the Round is inside its last few seconds.
 *
 * Stays true past zero on purpose. The local clock can overshoot the deadline
 * by a frame or two before the server's reveal arrives, and a warning that
 * switches off in the last moment before the answer is the one moment it should
 * not.
 */
export function isFinalStretch(remainingMs: number, idle: boolean): boolean {
  if (idle) return false;
  return remainingMs <= FINAL_STRETCH_MS;
}

/**
 * How many of the people the room is waiting on are done.
 *
 * Disconnected players are dropped from both halves rather than counted as
 * outstanding: they are still drawn in the strip, struck through, but the round
 * does not wait for them — and a count that did would sit at "2/3" until the
 * clock ran out and read as a room that had stalled.
 */
export function answeredSummary(
  players: readonly Player[],
  answeredPlayerIds: readonly string[],
  readyPlayerIds: readonly string[],
  loading: boolean,
): { done: number; total: number } {
  // The strip reports readiness while the audio buffers and answers once the
  // clock is running, so the count has to follow whichever it is showing.
  const finished = new Set(loading ? readyPlayerIds : answeredPlayerIds);
  const present = players.filter((p) => p.connected);
  return {
    done: present.filter((p) => finished.has(p.id)).length,
    total: present.length,
  };
}

/**
 * Whether the Match is being counted in.
 *
 * Only the Round that opens a Match gets a count: it is the one moment where
 * nobody is watching yet, because the room has been picking playlists and
 * somebody is still finding their headphones. Every Round after it gets a short
 * beat instead, and a number that flashed past on the way there would be noise.
 */
export function isCountIn(roundIndex: number, startAt: number, now: number): boolean {
  return roundIndex === 0 && now < startAt;
}

/**
 * The number on the count-in screen.
 *
 * Floored at one rather than allowed to reach zero: the clip starts on zero, so
 * a zero would sit there for a whole second promising a start that has already
 * happened.
 */
export function countInSeconds(startAt: number, now: number): number {
  return Math.max(Math.ceil((startAt - now) / 1000), 1);
}
