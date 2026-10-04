import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAnnouncementStore, imageType } from "@/server/announcements";
import { ANNOUNCEMENT_IMAGE_MAX_BYTES, announcementInput } from "@/shared/announcements";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe("announcement store", () => {
  let dir: string;
  let clock: number;
  let n: number;
  const store = () =>
    createAnnouncementStore({
      dir,
      now: () => clock,
      newId: () => `id${String(++n).padStart(12, "0")}`,
    });

  beforeEach(async () => {
    dir = join(await mkdtemp(join(tmpdir(), "announcements-")), "nested");
    clock = Date.parse("2026-10-05T12:00:00Z");
    n = 0;
  });
  afterEach(() => rm(join(dir, ".."), { recursive: true, force: true }));

  it("keeps notices newest first, and serves only the active ones", async () => {
    const s = store();
    expect((await s.create({ title: "old", body: "first" })).ok).toBe(true);
    clock += 1000;
    expect((await s.create({ title: "hidden", active: false })).ok).toBe(true);
    clock += 1000;
    expect((await s.create({ body: "  newest  " })).ok).toBe(true);

    expect((await s.list()).map((a) => a.title || a.body)).toEqual(["newest", "hidden", "old"]);
    expect((await s.active()).map((a) => a.title || a.body)).toEqual(["newest", "old"]);
    // A fresh store reads the same file.
    expect(await store().list()).toHaveLength(3);
  });

  it("refuses an empty notice, but a picture alone is enough", async () => {
    const s = store();
    expect(await s.create({ title: " ", body: "" })).toEqual({ ok: false, reason: "invalid" });
    const withImage = await s.create({}, PNG);
    expect(withImage.ok && withImage.announcement.image).toMatch(/\.png$/);
  });

  it("names a picture from its bytes, and refuses anything that is not one", async () => {
    const s = store();
    expect(await s.create({ title: "x" }, Buffer.from("<svg onload=alert(1)>"))).toEqual({
      ok: false,
      reason: "image-unknown",
    });
    expect(await s.create({ title: "x" }, Buffer.alloc(ANNOUNCEMENT_IMAGE_MAX_BYTES + 1))).toEqual({
      ok: false,
      reason: "image-too-large",
    });
    const ok = await s.create({ title: "x" }, PNG);
    if (!ok.ok) throw new Error("expected a notice");
    expect(await s.readImage(ok.announcement.image)).toEqual(PNG);
  });

  it("will not read outside its own folder", async () => {
    const s = store();
    expect(await s.readImage("../announcements.json")).toBeNull();
    expect(imageType("../../etc/passwd")).toBeNull();
    expect(imageType("abcdef123456.svg")).toBeNull();
    expect(imageType("abcdef123456.png")).toBe("image/png");
  });

  it("hides, shows and deletes, taking the picture with it", async () => {
    const s = store();
    const made = await s.create({ title: "x" }, PNG);
    if (!made.ok) throw new Error("expected a notice");
    const { id } = made.announcement;

    expect((await s.setActive(id, false)).ok).toBe(true);
    expect(await s.active()).toEqual([]);
    expect((await s.setActive("nope", true)).ok).toBe(false);

    expect(await s.remove(id)).toBe(true);
    expect(await s.list()).toEqual([]);
    expect(await readdir(join(dir, "images"))).toEqual([]);
    expect(await s.remove(id)).toBe(false);
  });

  it("does not lose a notice when two are saved at once", async () => {
    const s = store();
    await Promise.all([s.create({ title: "a" }), s.create({ title: "b" }), s.create({ title: "c" })]);
    expect(await s.list()).toHaveLength(3);
  });
});

describe("announcement links", () => {
  const parse = (linkUrl: string) => announcementInput.safeParse({ title: "x", linkUrl }).success;

  it("allow a page of this site or an https address, and nothing else", () => {
    expect(parse("")).toBe(true);
    expect(parse("/playlist/thai-hits")).toBe(true);
    expect(parse("https://example.com")).toBe(true);
    expect(parse("javascript:alert(1)")).toBe(false);
    expect(parse("http://example.com")).toBe(false);
    expect(parse("//evil.example")).toBe(false);
  });
});
