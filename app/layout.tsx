import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync, themeBootScript } from "@/components/Theme";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
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
  title: "Ethos — practice being worth listening to",
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
        className={`${spaceGrotesk.variable} ${inter.variable} ${spaceMono.variable} antialiased`}
      >
        <div className="mx-auto min-h-dvh max-w-[430px]">{children}</div>
        <Nav />
        <ServiceWorker />
        <ThemeSync />
      </body>
    </html>
  );
}
