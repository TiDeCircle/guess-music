import { adminKeyMatches } from "@/server/adminKey";
import { announcementStore } from "@/server/announcements";

/**
 * GET: the notices players should see, read by the popup on every visit.
 * POST: the admin page adding one, as multipart so a picture can ride along.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const announcements = await announcementStore().active();
  return Response.json({ announcements }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!adminKeyMatches(req.headers.get("x-admin-key"))) {
    return Response.json({ ok: false }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const file = form.get("image");
  const image = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : undefined;

  const result = await announcementStore().create(
    {
      title: text("title"),
      body: text("body"),
      linkUrl: text("linkUrl"),
      linkLabel: text("linkLabel"),
      active: text("active") !== "false",
    },
    image,
  );

  if (result.ok) return Response.json(result);
  return Response.json(result, { status: result.reason === "image-too-large" ? 413 : 400 });
}
