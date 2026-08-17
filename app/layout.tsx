import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Space_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync, themeBootScript } from "@/components/Theme";
import "./globals.css";

/*
 * Display face. Space Grotesk held this until 11 Aug and had to go for a
 * specific, checkable reason: its "1" carries a narrower advance than the
 * glyph occupies, so "11", "12", "31" and "118" render as collided mush.
 * That was documented as a trap and worked around by refusing tabular
 * figures — but this app's whole identity is numbers, and a display face
 * whose numerals are its weakest feature is the wrong face.
 *
 * Fraunces reads warm and editorial against the terracotta and cream,
 * which suits a product named for credibility earned rather than
 * claimed, and its numerals are unambiguous at every size we use.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-face",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  // §8 — the acquisition line goes anywhere a stranger meets Ethos
  // first. Clarity converts at zero awareness.
  title: "Ethos: practice being worth listening to",
  description:
    "Practice being worth listening to. Five minutes of reps a day, measured against timestamps, not vibes.",
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
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
        className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable} antialiased`}
      >
        <div className="mx-auto min-h-dvh max-w-[430px]">{children}</div>
        <Nav />
        <ServiceWorker />
        <ThemeSync />
      </body>
    </html>
  );
}
