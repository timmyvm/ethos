import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. Renders nothing of its own. */
export const metadata: Metadata = {
  title: "Settings · Ethos",
  description: "Reminders, practice, sound, appearance, your account and your data.",
  openGraph: { title: "Settings · Ethos", description: "Reminders, practice, sound, appearance, your account and your data." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
