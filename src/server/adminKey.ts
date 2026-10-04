import { timingSafeEqual } from "node:crypto";

/**
 * The one lock on the admin's pages and endpoints: FEEDBACK_KEY.
 *
 * There are no accounts in this app, so a long secret is the whole lock. One
 * key rather than one per page — there is one admin, and every extra secret is
 * another line in .env.local to forget. Unset means locked, not open.
 */
export function adminKeyMatches(given: string | null | undefined): boolean {
  const expected = process.env.FEEDBACK_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
