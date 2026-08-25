import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Create your account · Ethos",
  description: "Keep your recordings and your streak anywhere.",
  openGraph: { title: "Create your account · Ethos", description: "Keep your recordings and your streak anywhere." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
