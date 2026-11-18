import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Say it better · Ethos",
  description: "Better ways to say what you said in your recordings, and how many you now say on your own.",
  openGraph: {
    title: "Say it better · Ethos",
    description: "Better ways to say what you said in your recordings, and how many you now say on your own.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
