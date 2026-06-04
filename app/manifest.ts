import type { MetadataRoute } from "next";

// Web App Manifest — served at /manifest.webmanifest by Next.js metadata route.
// Combined with the service worker registered in <ServiceWorkerRegister />,
// this makes helmos.co installable to the home screen on iOS 16.4+ and
// Android Chrome, with no browser chrome (display: "standalone").
//
// Decisions (per Rory, 2026-06-03):
//   - name + short_name: "Helm" (not "Helmos") — brand-first
//   - icon: existing favicon assets at 192/512
//   - start_url: "/dashboard" — installed users almost always have a session;
//     middleware will bounce unauthed users to "/" anyway, so this gives the
//     fast path to the actual app instead of the marketing landing.
//   - theme_color: matches the brand gradient origin (#6366f1 indigo).
//   - background_color: the dashboard background (#0a0a0a) so the launch
//     splash on iOS doesn't flash white before the page paints.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Helm",
    short_name: "Helm",
    description:
      "AI Chief of Staff for independent music artists. One-sheets, bios, outreach, royalty audits — automated.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#6366f1",
    categories: ["music", "productivity", "business"],
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
      // The "maskable" variants tell Android to crop the icon into its
      // adaptive shape (circle/squircle). Our icon has enough padding
      // built in that the same PNG works in both modes; if Android ever
      // shows clipping, generate a separate maskable PNG with a 20% safe
      // zone and swap the src here.
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
