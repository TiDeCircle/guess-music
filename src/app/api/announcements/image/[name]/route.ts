import { announcementStore, imageType } from "@/server/announcements";

/**
 * A notice's picture. Names are the notice id, so a picture never changes
 * under its address and the browser may keep it for good.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const type = imageType(name);
  const bytes = type ? await announcementStore().readImage(name) : null;
  if (!type || !bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
