import { z } from "zod";

/**
 * What a player can send the person who made the game.
 *
 * Shared so the form and the endpoint agree on the limits without either one
 * restating them. There is no account behind a message: the optional contact
 * is the only way to answer one, and it is whatever the player chose to type.
 */

export const FEEDBACK_KINDS = ["bug", "idea", "song", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MESSAGE_MAX = 1000;
export const FEEDBACK_CONTACT_MAX = 100;
/** Where the player was, for a bug report; small and server-trimmed, never shown to anyone but the admin. */
export const FEEDBACK_CONTEXT_MAX = 200;

export const feedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MESSAGE_MAX),
  contact: z.string().trim().max(FEEDBACK_CONTACT_MAX).optional().default(""),
  context: z.string().trim().max(FEEDBACK_CONTEXT_MAX).optional().default(""),
  lang: z.enum(["th", "en"]).optional().default("th"),
});

export type FeedbackInput = z.infer<typeof feedbackInput>;

/** One line of the feedback file. */
export type FeedbackEntry = FeedbackInput & {
  at: string;
  userAgent: string;
};
