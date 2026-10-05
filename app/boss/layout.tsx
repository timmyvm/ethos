import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. The boss's proper
 * name is Cold Topic (#292), so the tab says that. */
const description =
  "Read for 4 minutes, then explain it from memory in 90 seconds.";

export const metadata: Metadata = {
  title: "Cold Topic · Ethos",
  description,
  openGraph: { title: "Cold Topic · Ethos", description },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
