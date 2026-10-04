import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FEEDBACK_LIMIT,
  FEEDBACK_WINDOW_MS,
  createFeedbackStore,
} from "@/server/feedback";
import { FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX } from "@/shared/feedback";
import { STRINGS } from "@/shared/strings";

const who = { ip: "1.2.3.4", userAgent: "test" };

describe("feedback store", () => {
  let dir: string;
  let file: string;
  let clock: number;
  const store = () => createFeedbackStore({ file, now: () => clock });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "feedback-"));
    file = join(dir, "nested", "feedback.jsonl");
    clock = Date.parse("2026-10-05T12:00:00Z");
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("appends a line per message, creating the folder, and lists newest first", async () => {
    const s = store();
    expect(await s.submit({ kind: "bug", message: " first ", context: "quiz · thai" }, who)).toEqual({ ok: true });
    clock += 1000;
    await s.submit({ kind: "song", message: "second", contact: "@me" }, who);

    const lines = (await readFile(file, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);

    const [newest, oldest] = await s.list();
    expect(newest).toMatchObject({ kind: "song", message: "second", contact: "@me", lang: "th" });
    expect(oldest).toMatchObject({ kind: "bug", message: "first", context: "quiz · thai", userAgent: "test" });
    expect(oldest?.at).toBe("2026-10-05T12:00:00.000Z");
  });

  it("rejects what the form would never send", async () => {
    const s = store();
    for (const body of [
      null,
      { kind: "bug" },
      { kind: "bug", message: "   " },
      { kind: "rant", message: "hi" },
      { kind: "bug", message: "x".repeat(FEEDBACK_MESSAGE_MAX + 1) },
    ]) {
      expect(await s.submit(body, who)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await s.list()).toEqual([]);
  });

  it("limits each address per window, and forgives once the window passes", async () => {
    const s = store();
    for (let i = 0; i < FEEDBACK_LIMIT; i++) {
      expect((await s.submit({ kind: "idea", message: `m${i}` }, who)).ok).toBe(true);
    }
    expect(await s.submit({ kind: "idea", message: "one more" }, who)).toEqual({
      ok: false,
      reason: "rate-limited",
    });
    // Someone else is not held to the first address's count.
    expect((await s.submit({ kind: "idea", message: "other" }, { ...who, ip: "5.6.7.8" })).ok).toBe(true);

    clock += FEEDBACK_WINDOW_MS;
    expect((await s.submit({ kind: "idea", message: "later" }, who)).ok).toBe(true);
  });

  it("skips a torn line instead of failing the whole list", async () => {
    const s = store();
    await s.submit({ kind: "other", message: "ok" }, who);
    await writeFile(file, (await readFile(file, "utf8")) + '{"kind":"bu', "utf8");
    expect(await s.list()).toHaveLength(1);
  });

  it("lists nothing before anyone has written", async () => {
    expect(await store().list()).toEqual([]);
  });
});

it("names every feedback kind in both languages", () => {
  for (const k of FEEDBACK_KINDS) {
    const s = STRINGS[`feedbackKind.${k}`];
    expect(s.th && s.en).toBeTruthy();
  }
});
