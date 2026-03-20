import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Helmos — AI Chief of Staff for Music",
  description:
    "Automated growth work for Creative Entrepreneurs. Paste your Spotify link and get a personalized action plan.",
  openGraph: {
    title: "Helmos — AI Chief of Staff for Music",
    description: "Automated growth work for Creative Entrepreneurs.",
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
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
