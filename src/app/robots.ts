import type { MetadataRoute } from "next";
import { SITE_URL } from "@/shared/site";

/** Everything is public; only the plumbing is kept out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/socket.io/", "/healthz", "/api/", "/feedback", "/announcements"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
