import { getPublicSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    getPublicSiteUrl() || "https://www.triptiles.app"
  ).replace(/\/$/, "");

  const staticPaths = [
    "",
    "/pricing",
    "/plans",
    "/login",
    "/signup",
    "/privacy",
    "/terms",
    "/cookies",
    "/feedback",
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency:
      path === "" || path === "/plans" ? "weekly" : ("monthly" as const),
    priority:
      path === ""
        ? 1
        : path === "/pricing"
          ? 0.9
          : path === "/plans"
            ? 0.85
            : 0.7,
  }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return staticRoutes;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: publicPlans } = await supabase
      .from("trips")
      .select("public_slug, updated_at")
      .eq("is_public", true)
      .not("public_slug", "is", null);

    const planRoutes: MetadataRoute.Sitemap = (publicPlans ?? [])
      .filter(
        (p): p is { public_slug: string; updated_at: string | null } =>
          typeof p?.public_slug === "string" && p.public_slug.length > 0,
      )
      .map((plan) => ({
        url: `${siteUrl}/plans/${plan.public_slug}`,
        lastModified: new Date(plan.updated_at ?? Date.now()),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    return [...staticRoutes, ...planRoutes];
  } catch {
    return staticRoutes;
  }
}
