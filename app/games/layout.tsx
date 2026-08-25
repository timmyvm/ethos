import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Games · Ethos",
  description: "Real practice under staged conditions. XP, never shortcuts.",
  openGraph: { title: "Games · Ethos", description: "Real practice under staged conditions. XP, never shortcuts." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
