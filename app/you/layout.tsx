import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "You · Ethos",
  description: "Level, streaks, traits, coins and your lexicon.",
  openGraph: { title: "You · Ethos", description: "Level, streaks, traits, coins and your lexicon." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
