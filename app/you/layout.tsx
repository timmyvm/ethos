import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. Coins left the
 * profile in #317, so the description no longer names them. */
export const metadata: Metadata = {
  title: "You · Ethos",
  description: "Say it better, your level, streaks and traits.",
  openGraph: { title: "You · Ethos", description: "Say it better, your level, streaks and traits." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
