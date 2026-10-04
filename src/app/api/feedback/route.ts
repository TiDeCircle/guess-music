import { feedbackStore } from "@/server/feedback";

/**
 * Where the feedback form posts.
 *
 * The site is proxied by Cloudflare, and nginx does not restore the visitor's
 * address, so X-Real-IP is a Cloudflare edge that many players share.
 * CF-Connecting-IP is the player, and Cloudflare overwrites it on the way in.
 * X-Real-IP only covers a request that reached the origin directly.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const result = await feedbackStore().submit(body, {
    ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown",
    userAgent: req.headers.get("user-agent") ?? "",
  });

  if (result.ok) return Response.json({ ok: true });
  return Response.json(result, { status: result.reason === "rate-limited" ? 429 : 400 });
}
