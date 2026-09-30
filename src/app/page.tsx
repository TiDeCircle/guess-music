import type { Metadata } from "next";
import { Game } from "@/client/Game";
import { MAX_PLAYERS } from "@/shared/protocol";
import { SITE_DESCRIPTION, SITE_URL } from "@/shared/site";
import { FAQ_KEYS, STRINGS } from "@/shared/strings";

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
 * What Google reads about the home page, as one graph:
 *
 * - WebSite picks the name printed above a result. Without it the result may
 *   carry the bare subdomain instead of "ทายเพลง".
 * - WebApplication says this is a free game played in the browser, not an
 *   article about one.
 * - FAQPage mirrors the questions HomeScreen shows, from the same strings.
 */
const HOME_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: STRINGS.appName.th,
      alternateName: [STRINGS.appName.en, "เกมทายเพลง"],
      url: `${SITE_URL}/`,
      inLanguage: "th",
    },
    {
      "@type": "WebApplication",
      name: `${STRINGS.appName.th} — ${STRINGS.appNameRest.th}`,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "GameApplication",
      operatingSystem: "Any (web browser)",
      inLanguage: "th",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_KEYS.map(([q, a]) => ({
        "@type": "Question",
        name: STRINGS[q].th,
        acceptedAnswer: {
          "@type": "Answer",
          text: STRINGS[a].th.replace("{max}", String(MAX_PLAYERS)),
        },
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_LD) }}
      />
      <Game />
    </>
  );
}
