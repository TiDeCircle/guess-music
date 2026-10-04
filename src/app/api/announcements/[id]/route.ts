import { adminKeyMatches } from "@/server/adminKey";
import { announcementStore } from "@/server/announcements";

/** The admin showing, hiding or deleting one notice. */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!adminKeyMatches(req.headers.get("x-admin-key"))) {
    return Response.json({ ok: false }, { status: 404 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const active = (body as { active?: unknown })?.active;
  if (typeof active !== "boolean") return Response.json({ ok: false, reason: "invalid" }, { status: 400 });

  const result = await announcementStore().setActive(id, active);
  return Response.json(result, { status: result.ok ? 200 : 404 });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!adminKeyMatches(req.headers.get("x-admin-key"))) {
    return Response.json({ ok: false }, { status: 404 });
  }
  const { id } = await params;
  const removed = await announcementStore().remove(id);
  return Response.json({ ok: removed }, { status: removed ? 200 : 404 });
}
