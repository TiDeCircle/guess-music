import type { Metadata } from "next";
import { Game } from "@/client/Game";

/**
 * The game is one client component; this server file exists so the page can
 * name its own address. Playlist pages link here as `/?playlist=…`, and
 * without a canonical each of those would be indexed as another copy of the
 * home page.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return <Game />;
}
