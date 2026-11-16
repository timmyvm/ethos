import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Welcome · Ethos",
  description: "Step into an interview, then meet daily speaking practice.",
  openGraph: { title: "Welcome · Ethos", description: "Step into an interview, then meet daily speaking practice." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
