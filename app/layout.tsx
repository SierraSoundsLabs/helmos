import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Helm — AI Artist Manager",
  description:
    "Get a personalized career analysis and AI-powered action plan for your music career. Powered by Spotify data and Claude.",
  openGraph: {
    title: "Helm — AI Artist Manager",
    description: "Paste your Spotify link. Get a personalized action plan.",
    siteName: "Helm",
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
