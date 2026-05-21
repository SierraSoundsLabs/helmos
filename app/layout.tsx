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
  title: "Helmos — Automated Chief Growth Officer for Music",
  description:
    "Automated Chief Growth Officer for Music. Paste your Spotify link and get a personalized action plan.",
  openGraph: {
    title: "Helmos — Automated Chief Growth Officer for Music",
    description: "Automated Chief Growth Officer for Music.",
    siteName: "Helmos",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <footer className="w-full text-center py-4 text-xs text-zinc-600">
          © 2026 Sierra Sounds LLC
        </footer>
        {/* Vercel Web Analytics — automatic pageview tracking + custom
            events. Free tier is 2,500 events/mo (plenty for Helm today).
            Requires one-click enable in Vercel project Settings → Analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
