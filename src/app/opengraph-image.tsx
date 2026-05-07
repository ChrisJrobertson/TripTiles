import { OgLogoLockup } from "@/lib/brand/og-logo-lockup";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "TripTiles — Plan your theme park trips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  // prettier-ignore
  return new ImageResponse(
    (
      <div style={{ background: "#2455ac", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 28, padding: 72 }}><div style={{ display: "flex", padding: "18px 24px", background: "#ffffff", borderRadius: 20, boxShadow: "0 12px 36px rgba(11, 30, 92, 0.22)" }}><OgLogoLockup /></div><div style={{ fontSize: 38, color: "#fce7cc", marginTop: 4, maxWidth: 820, lineHeight: 1.25, fontFamily: "Georgia, serif" }}>Plan theme park trips your family will actually follow</div><div style={{ fontSize: 26, color: "#dd4e14", opacity: 0.92, fontFamily: "Georgia, serif" }}>Smart layers · Weather-aware · Payments & reminders</div></div>
    ),
    { ...size },
  );
}
