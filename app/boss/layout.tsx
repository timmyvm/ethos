import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. The boss has one
 * name everywhere since #494, "Weekly boss" (it was Cold Topic, #292),
 * so the tab says that. */
const description =
  "A topic you've never studied. Read it, then explain it from memory.";

export const metadata: Metadata = {
  title: "Weekly boss · Ethos",
  description,
  openGraph: { title: "Weekly boss · Ethos", description },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
