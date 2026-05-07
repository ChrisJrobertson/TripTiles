import { ImageResponse } from "next/og";
import { OgLogoLockup } from "@/lib/brand/og-logo-lockup";
import { getPublicAdventureTitleFromRow } from "@/lib/public-trip-display";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** OG canvas — brand palette only (no mascot assets). */
export const alt = "TripTiles plan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trimmed = slug.trim();
  if (!trimmed) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          background: "#2455ac",
        }}
      >
        <div
          style={{
            padding: "18px 26px",
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 12px 36px rgba(11, 30, 92, 0.22)",
          }}
        >
          <OgLogoLockup />
        </div>
      </div>,
      size,
    );
  }

  try {
    const admin = createServiceRoleClient();
    const { data: tripRow } = await admin
      .from("trips")
      .select("*")
      .eq("public_slug", trimmed)
      .eq("is_public", true)
      .maybeSingle();

    if (!tripRow) {
      return new ImageResponse(
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            background: "#2455ac",
            color: "#fce7cc",
            fontFamily: "Georgia, serif",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              background: "#ffffff",
              borderRadius: 18,
              boxShadow: "0 10px 28px rgba(11, 30, 92, 0.2)",
            }}
          >
            <OgLogoLockup compact />
          </div>
          <div style={{ fontSize: 32 }}>Plan not found</div>
        </div>,
        size,
      );
    }

    const row = tripRow as Record<string, unknown>;
    const adventureName = getPublicAdventureTitleFromRow(row);
    const startDate = String(row.start_date ?? "");
    const endDate = String(row.end_date ?? "");
    const regionId =
      row.region_id != null ? String(row.region_id) : null;
    let dest = "Theme park adventure";
    if (regionId) {
      const { data: reg } = await admin
        .from("regions")
        .select("short_name, name, flag_emoji")
        .eq("id", regionId)
        .maybeSingle();
      if (reg && typeof reg === "object") {
        const r = reg as {
          short_name?: string;
          name?: string;
          flag_emoji?: string | null;
        };
        dest =
          r.short_name?.trim() ||
          r.name?.trim() ||
          dest;
      }
    }

    const dayMs =
      new Date(endDate).getTime() - new Date(startDate).getTime();
    const days = Math.max(1, Math.floor(dayMs / 86400000) + 1);

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          background: "#2455ac",
          border: "12px solid #dd4e14",
          color: "#fce7cc",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              background: "#ffffff",
              borderRadius: 18,
              boxShadow: "0 8px 24px rgba(11, 30, 92, 0.18)",
            }}
          >
            <OgLogoLockup compact />
          </div>
          <span style={{ fontSize: 40, color: "#dd4e14" }}>✦</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 56 }}>🎢</span>
          <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {adventureName}
          </span>
          <span style={{ fontSize: 28, color: "#dd4e14" }}>
            {startDate} — {endDate}
          </span>
          <span style={{ fontSize: 24, opacity: 0.9 }}>
            {days}-day {dest} plan
          </span>
        </div>
        <div style={{ fontSize: 18, opacity: 0.75 }}>
          Clone this itinerary on triptiles.app
        </div>
      </div>,
      size,
    );
  } catch {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2455ac",
        }}
      >
        <div
          style={{
            padding: "18px 26px",
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 12px 36px rgba(11, 30, 92, 0.22)",
          }}
        >
          <OgLogoLockup />
        </div>
      </div>,
      size,
    );
  }
}
