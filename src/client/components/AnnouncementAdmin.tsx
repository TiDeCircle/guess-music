"use client";

import { useState } from "react";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_LINK_LABEL_MAX,
  ANNOUNCEMENT_LINK_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  announcementImageUrl,
  type Announcement,
} from "@/shared/announcements";
import { Button } from "./Button";

/** Wide enough for a phone's popup at 2x; anything bigger is bytes nobody sees. */
const MAX_EDGE = 1200;

/**
 * Shrinks a big photo before upload, so a picture straight off a phone fits
 * under nginx's body limit. A small file goes up untouched — a PNG keeps its
 * transparency and a GIF keeps moving.
 */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= ANNOUNCEMENT_IMAGE_MAX_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((done) => canvas.toBlob((b) => done(b ?? file), "image/jpeg", 0.85));
}

const REASONS: Record<string, string> = {
  invalid: "ต้องมีหัวข้อ ข้อความ หรือรูปอย่างน้อยหนึ่งอย่าง และลิงก์ต้องเป็น https:// หรือขึ้นต้นด้วย /",
  "image-too-large": "รูปใหญ่เกินไป",
  "image-unknown": "รองรับแค่ PNG, JPG, GIF, WebP",
};

const when = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

const field =
  "mt-2 block w-full border border-ink bg-transparent p-3 outline-none placeholder:text-grey-300 focus:border-accent";

export function AnnouncementAdmin({
  adminKey,
  initial,
}: {
  adminKey: string;
  initial: Announcement[];
}) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const headers = { "x-admin-key": adminKey };

  const pick = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const reset = () => {
    setTitle("");
    setBody("");
    setLinkUrl("");
    setLinkLabel("");
    pick(null);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("body", body);
      form.set("linkUrl", linkUrl);
      form.set("linkLabel", linkLabel);
      if (image) form.set("image", await prepareImage(image), image.name);
      const res = await fetch("/api/announcements", { method: "POST", headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.announcement) {
        setItems((list) => [data.announcement as Announcement, ...list]);
        reset();
      } else {
        setError(REASONS[data.reason] ?? `บันทึกไม่สำเร็จ (${res.status})`);
      }
    } catch {
      setError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: Announcement) => {
    const res = await fetch(`/api/announcements/${a.id}`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    if (res.ok) setItems((list) => list.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`ลบประกาศ "${a.title || a.body.slice(0, 30) || "รูปภาพ"}" ?`)) return;
    const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE", headers });
    if (res.ok) setItems((list) => list.filter((x) => x.id !== a.id));
  };

  const empty = !title.trim() && !body.trim() && !image;

  return (
    <div className="mt-8 grid gap-12 md:grid-cols-12 md:gap-8">
      <form
        className="md:col-span-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <h2 className="border-t border-ink pt-3 font-semibold">สร้างประกาศใหม่</h2>

        <label className="mt-6 block">
          <span className="label text-grey-500">หัวข้อ</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ANNOUNCEMENT_TITLE_MAX} className={field} />
        </label>

        <label className="mt-4 block">
          <span className="label text-grey-500">ข้อความ</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={ANNOUNCEMENT_BODY_MAX}
            rows={6}
            className={`${field} resize-y`}
          />
        </label>

        <label className="mt-4 block">
          <span className="label text-grey-500">รูปภาพ (ไม่บังคับ)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm file:mr-3 file:border file:border-ink file:bg-paper file:px-3 file:py-2 file:text-ink"
          />
        </label>
        {preview && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-60 w-full border border-ink object-contain" />
            <button type="button" onClick={() => pick(null)} className="label mt-2 text-grey-500 hover:text-accent">
              เอารูปออก
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-4">
          <label className="col-span-2 block">
            <span className="label text-grey-500">ลิงก์ (ไม่บังคับ)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              maxLength={ANNOUNCEMENT_LINK_MAX}
              placeholder="https://… หรือ /playlist/…"
              className={field}
            />
          </label>
          <label className="block">
            <span className="label text-grey-500">ข้อความปุ่ม</span>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              maxLength={ANNOUNCEMENT_LINK_LABEL_MAX}
              placeholder="ดูเพิ่ม"
              className={field}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="label mt-4 text-accent">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Button type="submit" disabled={empty || busy}>
            {busy ? "กำลังบันทึก…" : "เผยแพร่"}
          </Button>
        </div>
      </form>

      <section className="md:col-span-7">
        <h2 className="border-t border-ink pt-3 font-semibold">
          ประกาศทั้งหมด <span className="numeric text-grey-500">{items.length}</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-6 text-grey-500">ยังไม่มีประกาศ</p>
        ) : (
          <ol className="mt-6">
            {items.map((a) => (
              <li key={a.id} className={`flex gap-4 border-t border-ink py-4 ${a.active ? "" : "opacity-50"}`}>
                {a.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={announcementImageUrl(a.image)} alt="" className="h-20 w-20 shrink-0 border border-ink object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="label flex flex-wrap gap-x-3 text-grey-500">
                    <span className={a.active ? "text-accent" : ""}>{a.active ? "เปิดอยู่" : "ซ่อน"}</span>
                    <span className="numeric">{when.format(new Date(a.createdAt))}</span>
                  </p>
                  {a.title && <p className="mt-1 font-semibold">{a.title}</p>}
                  {a.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-pretty">{a.body}</p>}
                  {a.linkUrl && <p className="mt-1 truncate text-sm text-grey-500">→ {a.linkUrl}</p>}
                  <div className="label mt-3 flex gap-4">
                    <button type="button" onClick={() => void toggle(a)} className="hover:text-accent">
                      {a.active ? "ซ่อน" : "เปิด"}
                    </button>
                    <button type="button" onClick={() => void remove(a)} className="text-grey-500 hover:text-accent">
                      ลบ
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
