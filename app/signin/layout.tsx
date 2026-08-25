import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Sign in · Ethos",
  description: "Back to your streak.",
  openGraph: { title: "Sign in · Ethos", description: "Back to your streak." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
