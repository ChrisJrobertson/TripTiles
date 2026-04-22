import { ImageResponse } from "next/og";

/**
 * OG canvas uses royal blue (#0B1E5C). The full-colour logo PNG has a white box
 * around the artwork, so we keep a gold text wordmark here until a transparent
 * logo asset exists for dark backgrounds.
 */
export const runtime = "edge";
export const alt = "TripTiles — Plan your theme park trips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0B1E5C",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 112,
            color: "#C9A961",
            fontFamily: "Georgia, serif",
            fontWeight: 600,
          }}
        >
          TripTiles
        </div>
        <div
          style={{
            fontSize: 44,
            color: "#FAF8F3",
            marginTop: 28,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Plan theme park trips in minutes
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#C9A961",
            marginTop: 20,
            opacity: 0.9,
          }}
        >
          300+ parks · 45 destinations · Trip-powered
        </div>
      </div>
    ),
    { ...size },
  );
}
