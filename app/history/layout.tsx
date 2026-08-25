import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Log · Ethos",
  description: "Every recording, every number, oldest to newest.",
  openGraph: { title: "Log · Ethos", description: "Every recording, every number, oldest to newest." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
