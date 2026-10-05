import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "The lesson · Ethos",
  description: "The technique, before you record.",
  openGraph: {
    title: "The lesson · Ethos",
    description: "The technique, before you record.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
