import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Shop · Ethos",
  description: "Spend coins earned by speaking. Nothing here buys a score.",
  openGraph: { title: "Shop · Ethos", description: "Spend coins earned by speaking. Nothing here buys a score." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
