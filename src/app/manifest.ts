import type { MetadataRoute } from "next";

/** Installable from the artist's link: no store needed to get the app on the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brief",
    short_name: "Brief",
    description: "Artists, by city. Book the ones you follow.",
    start_url: "/explore?source=pwa",
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
