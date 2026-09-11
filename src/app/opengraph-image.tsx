import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The card a shared link unfolds into on LINE, Facebook and X.
 *
 * The home screen's poster, flattened: the mark, the name set big against
 * white, a hairline, one line of what it is. Satori draws it and needs its
 * fonts as files — the Plex Thai the page loads through next/font is not
 * reachable from here — so the same face ships in assets/fonts (OFL).
 */
export const alt = "ทายเพลง — Guess Music";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#000000";
const PAPER = "#ffffff";
const GREY = "#767676";
const ACCENT = "#e30613";

export default async function OpenGraphImage() {
  const bold = await readFile(join(process.cwd(), "assets/fonts/IBMPlexSansThai-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: "64px 80px",
          fontFamily: "Plex Thai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark size={64} />
          <div style={{ fontSize: 28, letterSpacing: "0.14em" }}>GUESS MUSIC</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 210, lineHeight: 1, letterSpacing: "-0.03em" }}>ทายเพลง</div>
          <div style={{ marginTop: 20, fontSize: 40, color: GREY }}>
            ไทย · สากล · เคป็อป · อนิเมะ
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${INK}`,
            paddingTop: 24,
            fontSize: 32,
          }}
        >
          {/* No syllable here stacks two marks above a consonant, as ชื่อ and
              เพื่อน do: Satori draws the first mark and drops the second. */}
          <span>ฟังคลิป ทายเพลง แข่งกันแบบเรียลไทม์</span>
          <span style={{ width: 28, height: 28, background: ACCENT }} />
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Plex Thai", data: bold, weight: 700, style: "normal" }] },
  );
}

/** The bar mark from src/app/icon.svg, in the fixed colours a PNG needs. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" fill={INK} />
      <rect x="6" y="14" width="4" height="4" fill={PAPER} />
      <rect x="12" y="8" width="4" height="16" fill={PAPER} />
      <rect x="18" y="11" width="4" height="10" fill={ACCENT} />
      <rect x="24" y="6" width="2" height="20" fill={PAPER} />
    </svg>
  );
}
