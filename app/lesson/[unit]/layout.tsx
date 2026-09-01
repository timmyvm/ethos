import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "The lesson · Ethos",
  description: "What this unit trains, and how to do it.",
  openGraph: {
    title: "The lesson · Ethos",
    description: "What this unit trains, and how to do it.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
