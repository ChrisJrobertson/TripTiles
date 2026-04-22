import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastViewport } from "@/components/app/ToastViewport";
import { getPublicSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteBase = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteBase),
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
  },
  title: {
    default: "TripTiles — Plan your theme park trips in minutes",
    template: "%s · TripTiles",
  },
  description:
    "Trip-powered trip planner for theme park holidays worldwide. Build beautiful, printable itineraries for Disney, Universal, and 300+ parks across 45 destinations.",
  keywords: [
    "theme park planner",
    "Disney World itinerary",
    "family holiday",
    "Orlando planner",
    "Paris Disneyland",
    "trip itinerary",
  ],
  authors: [{ name: "TripTiles" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteBase,
    siteName: "TripTiles",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@triptiles",
    title: "TripTiles",
    description:
      "Plan theme park trips on one visual calendar — Smart Plan, PDF export, Trip Passport.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ToastViewport />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
