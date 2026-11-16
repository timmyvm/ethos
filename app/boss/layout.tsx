import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. The boss's proper
 * name is Cold Topic (#292), so the tab says that. */
const description =
  "A topic you've never studied. Read it, then explain it from memory.";

export const metadata: Metadata = {
  title: "Cold Topic · Ethos",
  description,
  openGraph: { title: "Cold Topic · Ethos", description },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
