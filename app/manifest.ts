/**
 * Web App Manifest
 *
 * Makes BIT Focus installable as a standalone app. Served by Next.js at
 * `/manifest.webmanifest`; the service worker in `public/sw.js` handles
 * opening without a connection.
 *
 * @fileoverview PWA manifest
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BIT Focus",
    short_name: "BIT Focus",
    description: "Plz focus... for a bit. ha ha ha.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Focus", url: "/focus" },
      { name: "All sessions", url: "/focus-table" },
    ],
  };
}
