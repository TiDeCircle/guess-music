import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  announcementInput,
  type Announcement,
} from "@/shared/announcements";

/**
 * The admin's notices, in one JSON file, and their pictures in a folder beside it.
 *
 * Same reasoning as feedback (src/server/feedback.ts): a few notices a month
 * do not earn a database, and data/ is gitignored, so a pull leaves both alone.
 * The file is rewritten whole on every change, through a temporary file and a
 * rename, so a crash mid-write leaves the old list rather than half a new one.
 */

export function announcementsDir(): string {
  return resolve(process.env.ANNOUNCEMENTS_DIR ?? "data/announcements");
}

/** What a stored picture is, read from its first bytes — never from the name or type the browser sent. */
const IMAGE_KINDS: Array<{ ext: string; type: string; sniff: (b: Buffer) => boolean }> = [
  { ext: "png", type: "image/png", sniff: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", type: "image/jpeg", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", type: "image/gif", sniff: (b) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  {
    ext: "webp",
    type: "image/webp",
    sniff: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

/** A stored picture's name: our id and a known extension, nothing a path could hide in. */
const IMAGE_NAME = /^[a-z0-9]{12,32}\.(png|jpg|gif|webp)$/;

export function imageType(name: string): string | null {
  if (!IMAGE_NAME.test(name)) return null;
  const ext = name.slice(name.lastIndexOf(".") + 1);
  return IMAGE_KINDS.find((k) => k.ext === ext)?.type ?? null;
}

export type SaveResult =
  | { ok: true; announcement: Announcement }
  | { ok: false; reason: "invalid" | "image-too-large" | "image-unknown" | "not-found" };

export function createAnnouncementStore({
  dir,
  now = () => Date.now(),
  newId = () => randomBytes(8).toString("hex"),
}: {
  dir: string;
  now?: () => number;
  newId?: () => string;
}) {
  const file = join(dir, "announcements.json");
  const images = join(dir, "images");

  async function readAll(): Promise<Announcement[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
      return Array.isArray(parsed) ? (parsed as Announcement[]) : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async function writeAll(list: Announcement[]): Promise<void> {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2) + "\n", "utf8");
    await rename(tmp, file);
  }

  /**
   * Changes run one after another. Two admin tabs saving at once would
   * otherwise both read the old list and the second write would drop the first.
   */
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => {});
    return next;
  }

  /** Newest first, hidden ones included — the admin's view. */
  async function list(): Promise<Announcement[]> {
    return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** What players see. */
  async function active(): Promise<Announcement[]> {
    return (await list()).filter((a) => a.active);
  }

  function create(fields: unknown, image?: Buffer): Promise<SaveResult> {
    return serial(async () => {
      const parsed = announcementInput.safeParse(fields);
      if (!parsed.success) return { ok: false, reason: "invalid" };
      // A notice with nothing in it would open an empty box on every visitor's screen.
      if (!parsed.data.title && !parsed.data.body && !image?.length) return { ok: false, reason: "invalid" };

      const id = newId();
      let imageName = "";
      if (image?.length) {
        if (image.length > ANNOUNCEMENT_IMAGE_MAX_BYTES) return { ok: false, reason: "image-too-large" };
        const kind = IMAGE_KINDS.find((k) => k.sniff(image));
        if (!kind) return { ok: false, reason: "image-unknown" };
        imageName = `${id}.${kind.ext}`;
        await mkdir(images, { recursive: true });
        await writeFile(join(images, imageName), image);
      }

      const announcement: Announcement = {
        ...parsed.data,
        id,
        image: imageName,
        createdAt: new Date(now()).toISOString(),
      };
      await writeAll([...(await readAll()), announcement]);
      return { ok: true, announcement };
    });
  }

  function setActive(id: string, isActive: boolean): Promise<SaveResult> {
    return serial(async () => {
      const all = await readAll();
      const found = all.find((a) => a.id === id);
      if (!found) return { ok: false, reason: "not-found" };
      found.active = isActive;
      await writeAll(all);
      return { ok: true, announcement: found };
    });
  }

  function remove(id: string): Promise<boolean> {
    return serial(async () => {
      const all = await readAll();
      const found = all.find((a) => a.id === id);
      if (!found) return false;
      await writeAll(all.filter((a) => a.id !== id));
      if (found.image) await rm(join(images, found.image), { force: true });
      return true;
    });
  }

  /** A stored picture's bytes, or null for any name that is not one of ours. */
  async function readImage(name: string): Promise<Buffer | null> {
    if (!imageType(name)) return null;
    try {
      return await readFile(join(images, name));
    } catch {
      return null;
    }
  }

  return { list, active, create, setActive, remove, readImage };
}

/** The one store the app uses — module state, so the write queue covers every request (docs/adr/0004). */
let store: ReturnType<typeof createAnnouncementStore> | null = null;
export function announcementStore() {
  store ??= createAnnouncementStore({ dir: announcementsDir() });
  return store;
}
