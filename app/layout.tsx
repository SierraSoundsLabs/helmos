import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Helmos — Automated Chief Growth Officer for Music",
  description:
    "Automated Chief Growth Officer for Music. Paste your Spotify link and get a personalized action plan.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
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
      <head>
        {/* Hard-coded favicon — bypasses Next.js file-based routing cache */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
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
