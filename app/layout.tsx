import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <footer className="w-full text-center py-4 text-xs text-zinc-600">
          © 2026 Sierra Sounds LLC
        </footer>
      </body>
    </html>
  );
}
