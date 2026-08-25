import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Welcome · Ethos",
  description: "Meet the daily speaking gym. Three screens and you're on the floor.",
  openGraph: { title: "Welcome · Ethos", description: "Meet the daily speaking gym. Three screens and you're on the floor." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
