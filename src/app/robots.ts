import { getPublicSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (
    getPublicSiteUrl() || "https://www.triptiles.app"
  ).replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/planner",
          "/settings",
          "/achievements",
          "/passport",
          "/invite/",
          "/reset-password",
          "/auth/",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
