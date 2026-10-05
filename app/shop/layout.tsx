import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Shop · Ethos",
  description: "Streak freezes and Demos poses, bought with the coins you earn by speaking.",
  openGraph: { title: "Shop · Ethos", description: "Streak freezes and Demos poses, bought with the coins you earn by speaking." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
