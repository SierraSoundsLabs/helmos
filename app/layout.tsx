import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Icons are handled by the Next.js file convention — app/favicon.ico,
// app/icon.png, app/apple-icon.png. Next auto-injects content-hashed
// <link> tags, so changing an icon busts the browser cache automatically.
// Do NOT re-add a metadata.icons block or hard-coded <head> <link> tags —
// duplicate/fixed-URL favicon definitions were causing the wrong icon to
// stick in browser caches.
export const metadata: Metadata = {
  metadataBase: new URL("https://helmos.co"),
  title: {
    default: "Helm — AI Chief of Staff for Independent Music Artists",
    template: "%s — Helm",
  },
  description:
    "Helm is an AI Chief of Staff for independent music artists. Generate one-sheets, bios, press releases, playlist pitches, and royalty audits — and send real outreach. Paste your Spotify link to get started.",
  keywords: [
    "AI music manager",
    "music artist tools",
    "one-sheet generator",
    "EPK builder",
    "playlist pitch",
    "royalty audit",
    "music marketing AI",
    "Spotify artist analytics",
    "indie music tools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://helmos.co/",
    siteName: "Helm",
    title: "Helm — AI Chief of Staff for Independent Music Artists",
    description:
      "Generate one-sheets, bios, press releases, playlist pitches, and royalty audits — automated for indie artists.",
  },
  twitter: {
    card: "summary",
    title: "Helm — AI Chief of Staff for Independent Music Artists",
    description:
      "Generate one-sheets, bios, press releases, playlist pitches, and royalty audits — automated for indie artists.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Site-wide JSON-LD — Organization + WebSite. Goes inline in <head> so it's
// available to crawlers without JS execution.
const ROOT_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Helm",
    legalName: "Sierra Sounds LLC",
    url: "https://helmos.co",
    logo: "https://helmos.co/icon.png",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Helm",
    url: "https://helmos.co",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Site-wide JSON-LD (Organization + WebSite) for rich results.
            Favicons are NOT here — handled by the app/ file convention. */}
        {ROOT_STRUCTURED_DATA.map((entry, i) => (
          <script
            key={i}
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
          />
        ))}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <footer className="w-full text-center py-4 text-xs text-zinc-600 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
          <span>© 2026 Sierra Sounds LLC</span>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms</a>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</a>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <a href="/support" className="hover:text-zinc-400 transition-colors">Support</a>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <a href="mailto:support@helmos.co" className="hover:text-zinc-400 transition-colors">support@helmos.co</a>
        </footer>
        {/* Vercel Web Analytics — automatic pageview tracking + custom
            events. Free tier is 2,500 events/mo (plenty for Helm today).
            Requires one-click enable in Vercel project Settings → Analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
