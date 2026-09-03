import type { Metadata, Viewport } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Nav } from "@/components/Nav";
import { OutboxRetry } from "@/components/OutboxRetry";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync, themeBootScript } from "@/components/Theme";
import "./globals.css";

/*
 * Display face — Outfit (DECISIONS #201, the Instrument reskin): the
 * numbers-and-UI voice. Variable, so 600/700/800 are real weights, and
 * every numeral sets tabular (globals.css) — a changing metric must not
 * reflow as its digits change.
 */
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display-face",
});

/* Body face — prose only in the Instrument system; labels, numbers and
 * row titles all speak Outfit. */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  // §8 — the acquisition line goes anywhere a stranger meets Ethos
  // first. Clarity converts at zero awareness.
  metadataBase: new URL("https://speakethos.com"),
  title: "Ethos: practice being worth listening to",
  description:
    "Practice being worth listening to. Five minutes of practice a day, measured against timestamps, not vibes.",
  icons: { apple: "/apple-touch-icon.png" },
  openGraph: {
    siteName: "Ethos",
    type: "website",
    url: "/",
    title: "Ethos: practice being worth listening to",
    description:
      "Five minutes of practice a day, measured against timestamps, not vibes.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Ethos. Practice being worth listening to.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ethos: practice being worth listening to",
    description:
      "Five minutes of practice a day, measured against timestamps, not vibes.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f5ead8",
  width: "device-width",
  initialScale: 1,
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
        className={`${outfit.variable} ${figtree.variable} antialiased`}
      >
        <div className="mx-auto min-h-dvh max-w-[430px]">{children}</div>
        <Nav />
        <ServiceWorker />
        <ThemeSync />
        <OutboxRetry />
      </body>
    </html>
  );
}
