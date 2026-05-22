import type { MetadataRoute } from "next";
import { kvKeys, kvGet } from "@/lib/kv";
import type { OneSheetData } from "@/lib/types";

// Real /sitemap.xml — Next.js 15 metadata route.
// Without this file, the catch-all [artistSlug] route was matching
// /sitemap.xml and returning the "Artist not found" HTML page to crawlers.
//
// We surface:
//   - the homepage
//   - every published artist's public profile (/{slug}) and printable
//     one-sheet (/one-sheet/{slug}) — these are the real SEO assets,
//     each one is a unique page about a real musician
//
// Private/authenticated paths (dashboard, account, etc.) are excluded
// here AND disallowed in robots.ts.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://helmos.co";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  // Pull every published one-sheet slug. Each published artist gets two
  // canonical entries: the rich profile (/slug) and the printable
  // one-sheet (/one-sheet/slug).
  let artistRoutes: MetadataRoute.Sitemap = [];
  try {
    const keys = await kvKeys("onesheet:*");
    const entries = await Promise.all(
      keys.map(async (k) => {
        const slug = k.slice("onesheet:".length);
        const data = await kvGet<OneSheetData>(k);
        const lastModified = data?.createdAt ? new Date(data.createdAt) : now;
        return [
          {
            url: `${base}/${slug}`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.9,
          },
          {
            url: `${base}/one-sheet/${slug}`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          },
        ];
      })
    );
    artistRoutes = entries.flat();
  } catch (err) {
    // KV failure shouldn't break sitemap generation — return what we
    // have so crawlers at least see the homepage.
    console.error("sitemap KV scan failed", err);
  }

  return [...staticRoutes, ...artistRoutes];
}
