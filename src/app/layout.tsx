import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastViewport } from "@/components/app/ToastViewport";
import { AppProviders } from "@/app/providers";
import { getPublicSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteBase = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteBase),
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
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
        className={`${inter.variable} ${fraunces.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
        <ToastViewport />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
