import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Log · Ethos",
  description: "Your Ethos since you started, and every recording.",
  openGraph: { title: "Log · Ethos", description: "Your Ethos since you started, and every recording." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
