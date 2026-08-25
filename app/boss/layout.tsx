import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Weekly boss · Ethos",
  description: "A cold topic, minutes to read it, ninety seconds to explain it.",
  openGraph: { title: "Weekly boss · Ethos", description: "A cold topic, minutes to read it, ninety seconds to explain it." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
