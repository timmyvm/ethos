import type { Metadata } from "next";

/* Metadata for a client page: the segment layout is the App Router's
 * place to declare it. No title of its own (#430 review): the shell any
 * visitor gets is the app's, so it says nothing about a page that answers
 * everyone but the founder as if it did not exist. Kept out of search.
 * Renders nothing of its own. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
