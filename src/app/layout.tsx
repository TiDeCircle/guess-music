import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from "next/font/google";
import { LangProvider } from "@/client/LangProvider";
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

export const metadata: Metadata = {
  title: "ทายเพลง — Guess Music",
  description: "ฟังคลิป ทายชื่อเพลง แข่งกับเพื่อนแบบเรียลไทม์",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // The answer grid is tap-heavy; letting it zoom on double-tap costs taps.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${plex.variable} ${plexThai.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
