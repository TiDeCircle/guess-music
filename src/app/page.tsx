import type { Metadata } from "next";
import { Game } from "@/client/Game";
import { SITE_URL } from "@/shared/site";
import { STRINGS } from "@/shared/strings";

/**
 * The game is one client component; this server file exists so the page can
 * speak for itself to search engines.
 *
 * Public pages link here as `/?playlist=…` and `/?artist=…`, and without the
 * canonical each of those would be indexed as another copy of the home page.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * What Google reads to pick the name it prints above a result. Without it the
 * result may carry the bare subdomain instead of "ทายเพลง".
 */
const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: STRINGS.appName.th,
  alternateName: [STRINGS.appName.en, "เกมทายเพลง"],
  url: `${SITE_URL}/`,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
      />
      <Game />
    </>
  );
}
