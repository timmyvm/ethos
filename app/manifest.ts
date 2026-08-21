import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // An install prompt is an acquisition surface — §8's clarity line,
    // not the hero line.
    name: "Ethos: practice being worth listening to",
    short_name: "Ethos",
    description:
      "Practice being worth listening to. Five minutes of practice a day, measured against timestamps, not vibes.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#FAF7F2",
    icons: [
      { src: "/icon-192.webp", sizes: "192x192", type: "image/webp" },
      { src: "/icon-512.webp", sizes: "512x512", type: "image/webp" },
    ],
  };
}
