import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Testing Ethos · Ethos",
  description: "A tester code, and what testing means for your recordings.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
