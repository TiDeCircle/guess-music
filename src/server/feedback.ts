import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { feedbackInput, type FeedbackEntry } from "@/shared/feedback";

/**
 * Feedback lands in a JSON Lines file, one message per line.
 *
 * Not a database, for the same reason rooms are not in one (docs/adr/0004): a
 * handful of messages a week does not earn a datastore. Appending a line is
 * atomic enough at this volume, the file survives deploys because it is
 * gitignored and `git pull` leaves it alone, and `tail` reads it over ssh when
 * the admin page is too far away.
 */

/** Per address, so one person mashing send cannot fill the disk. */
export const FEEDBACK_LIMIT = 5;
export const FEEDBACK_WINDOW_MS = 10 * 60 * 1000;

export function feedbackFile(): string {
  return resolve(process.env.FEEDBACK_FILE ?? "data/feedback.jsonl");
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate-limited" };

export function createFeedbackStore({
  file,
  now = () => Date.now(),
}: {
  file: string;
  now?: () => number;
}) {
  /** Send times per address. Process memory, like rooms: a restart forgives everyone. */
  const recent = new Map<string, number[]>();

  function allow(ip: string): boolean {
    const t = now();
    const kept = (recent.get(ip) ?? []).filter((at) => t - at < FEEDBACK_WINDOW_MS);
    if (kept.length >= FEEDBACK_LIMIT) {
      recent.set(ip, kept);
      return false;
    }
    kept.push(t);
    recent.set(ip, kept);
    return true;
  }

  async function submit(
    body: unknown,
    { ip, userAgent }: { ip: string; userAgent: string },
  ): Promise<SubmitResult> {
    const parsed = feedbackInput.safeParse(body);
    if (!parsed.success) return { ok: false, reason: "invalid" };
    if (!allow(ip)) return { ok: false, reason: "rate-limited" };

    const entry: FeedbackEntry = {
      ...parsed.data,
      at: new Date(now()).toISOString(),
      userAgent: userAgent.slice(0, 300),
    };
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(entry) + "\n", "utf8");
    return { ok: true };
  }

  /** Newest first. A torn or hand-edited line is skipped rather than breaking the page. */
  async function list(): Promise<FeedbackEntry[]> {
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const entries: FeedbackEntry[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as FeedbackEntry);
      } catch {
        // skip
      }
    }
    return entries.reverse();
  }

  return { submit, list };
}

/**
 * The one store the app uses. Module state, so the rate limit is shared by
 * every request this process serves — which is all of them (docs/adr/0004).
 */
let store: ReturnType<typeof createFeedbackStore> | null = null;
export function feedbackStore() {
  store ??= createFeedbackStore({ file: feedbackFile() });
  return store;
}
