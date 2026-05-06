import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "TripTiles — Plan your theme park trips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2455ac",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 24,
          padding: 72,
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#dd4e14",
            fontFamily: "Georgia, serif",
            letterSpacing: "0.28em",
            fontWeight: 700,
          }}
        >
          ✦ TRIPTILES ✦
        </div>
        <div
          style={{
            fontSize: 88,
            color: "#dd4e14",
            fontFamily: "Georgia, serif",
            fontWeight: 600,
            lineHeight: 1.05,
          }}
        >
          TripTiles
        </div>
        <div
          style={{
            fontSize: 38,
            color: "#fce7cc",
            marginTop: 8,
            maxWidth: 760,
            lineHeight: 1.25,
          }}
        >
          Plan theme park trips your family will actually follow
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#dd4e14",
            opacity: 0.92,
          }}
        >
          Smart layers · Weather-aware · Payments & reminders
        </div>
      </div>
    ),
    { ...size },
  );
}
