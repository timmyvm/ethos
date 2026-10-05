import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. The tab is Practice
 * since #294; the route keeps its old name. */
const description = "The weekly boss, Q&A, and your own recordings, every one measured.";

export const metadata: Metadata = {
  title: "Practice · Ethos",
  description,
  openGraph: { title: "Practice · Ethos", description },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
