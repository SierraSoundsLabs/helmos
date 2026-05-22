import type { MetadataRoute } from "next";

// Real /robots.txt — Next.js 15 metadata route.
// Without this file, the catch-all [artistSlug] route was matching
// /robots.txt and returning the "Artist not found" HTML page to crawlers.
// (Confirmed: helmos.co/robots.txt returned HTTP 200 with HTML body.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/account",
          "/intake",
          "/reset-password",
          "/forgot-password",
          "/login",
          "/success",
        ],
      },
    ],
    sitemap: "https://helmos.co/sitemap.xml",
    host: "https://helmos.co",
  };
}
