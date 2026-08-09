import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ethos — a daily gym for speech",
    short_name: "Ethos",
    description:
      "Five minutes of reps a day until speaking clearly under pressure is a trait, not a performance.",
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
