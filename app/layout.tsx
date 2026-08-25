import type { Metadata, Viewport } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync, themeBootScript } from "@/components/Theme";
import "./globals.css";

/*
 * Display face — Caprasimo (DECISIONS #166, the Organic redesign). It
 * carries one weight, 400, and is never fake-bolded: globals.css pins
 * the weight on `.font-display`. Its numerals are wide, round and
 * unambiguous at every size we use, which is what a product whose
 * identity is numbers needs from its display face.
 */
const caprasimo = Caprasimo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-face",
});

/* Body face. 400/600 for prose, 700 for the data-label register
 * (Space Mono retired with the redesign), 800 for row titles. */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  // §8 — the acquisition line goes anywhere a stranger meets Ethos
  // first. Clarity converts at zero awareness.
  title: "Ethos: practice being worth listening to",
  description:
    "Practice being worth listening to. Five minutes of practice a day, measured against timestamps, not vibes.",
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f5ead8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before paint, or a dark-mode user gets a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${caprasimo.variable} ${figtree.variable} antialiased`}
      >
        <div className="mx-auto min-h-dvh max-w-[430px]">{children}</div>
        <Nav />
        <ServiceWorker />
        <ThemeSync />
      </body>
    </html>
  );
}
