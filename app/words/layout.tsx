import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Your words · Ethos",
  description: "The words you said and the ones to use instead, saved from your recordings.",
  openGraph: { title: "Your words · Ethos", description: "The words you said and the ones to use instead, saved from your recordings." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
