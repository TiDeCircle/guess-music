import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from "next/font/google";
import { LangProvider } from "@/client/LangProvider";
import { THEME_INIT_SCRIPT } from "@/client/theme";
import { OPEN_GRAPH_BASE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/shared/site";
import "./globals.css";

/**
 * Both faces come from the same family, so Thai and Latin share metrics and a
 * line of mixed script sits on one baseline without per-language tuning.
 */
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

/**
 * What search engines and link previews read, for every page.
 *
 * No canonical here: it would be inherited by every page below, and each
 * playlist page is an address of its own. The home page and the playlist pages
 * set theirs. The preview image is src/app/opengraph-image.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · ทายเพลง" },
  description: SITE_DESCRIPTION,
  openGraph: { ...OPEN_GRAPH_BASE, title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  // The browser chrome around the page follows the page, so a dark game does
  // not sit under a white address bar.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
  // The answer grid is tap-heavy; letting it zoom on double-tap costs taps.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script below stamps `data-theme` on this element before React
    // hydrates, so the client's html tag deliberately does not match the
    // server's. Suppressed here and nowhere else: it covers this element's own
    // attributes only, not its contents.
    <html
      lang="th"
      className={`${plex.variable} ${plexThai.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking, and before anything paints: a saved dark choice has to be
            on the root element by the first frame, or the page flashes white on
            its way to being dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
