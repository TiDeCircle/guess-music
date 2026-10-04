import { z } from "zod";

/**
 * A notice from the person who runs the site to everyone who opens it — a new
 * mode, a playlist that came back, a planned restart.
 *
 * Shared so the admin form, the endpoints and the popup agree on the limits.
 * Written by the admin in whatever language they choose; there is no th/en
 * pair, because a notice is a message from a person, not UI copy.
 */

export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 2000;
export const ANNOUNCEMENT_LINK_MAX = 500;
export const ANNOUNCEMENT_LINK_LABEL_MAX = 40;

/**
 * Under nginx's 2M body limit with room for the form around it. The admin page
 * shrinks a bigger photo in the browser before it gets this far.
 */
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 1_500_000;

/** Only where a link may go: a page of this site, or somewhere over https. */
const link = z
  .string()
  .trim()
  .max(ANNOUNCEMENT_LINK_MAX)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v), {
    message: "link must be a path on this site or an https address",
  });

export const announcementInput = z.object({
  title: z.string().trim().max(ANNOUNCEMENT_TITLE_MAX).default(""),
  body: z.string().trim().max(ANNOUNCEMENT_BODY_MAX).default(""),
  linkUrl: link.default(""),
  linkLabel: z.string().trim().max(ANNOUNCEMENT_LINK_LABEL_MAX).default(""),
  active: z.boolean().default(true),
});

export type AnnouncementInput = z.infer<typeof announcementInput>;

/** One notice, as stored and as served. */
export type Announcement = AnnouncementInput & {
  id: string;
  /** Served from /api/announcements/image/<file>, or "" for a text-only notice. */
  image: string;
  createdAt: string;
};

export function announcementImageUrl(file: string): string {
  return file ? `/api/announcements/image/${file}` : "";
}
