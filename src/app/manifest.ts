import type { MetadataRoute } from "next";

/** Installable from the artist's link: no store needed to get the app on the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vanta",
    short_name: "Vanta",
    description: "Find your artist. See the work, read the magazine, book the session.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
