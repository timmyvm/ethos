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
    background_color: "#faf8f3",
    theme_color: "#faf8f3",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Same mascot, held inside the 80% safe zone so a round or
      // squircle mask can't clip him.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
