import { ImageResponse } from "next/og";
import { getTrippMascotDataUrl } from "@/lib/og/tripp-mascot-data-url";

export const runtime = "nodejs";
export const alt = "TripTiles — Plan your theme park trips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const tripp = getTrippMascotDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          background: "#2455ac",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          padding: 64,
        }}
      >
        <img
          src={tripp}
          width={320}
          height={320}
          alt=""
          style={{ objectFit: "contain" }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            flex: 1,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              fontSize: 96,
              color: "#dd4e14",
              fontFamily: "Georgia, serif",
              fontWeight: 600,
            }}
          >
            TripTiles
          </div>
          <div
            style={{
              fontSize: 40,
              color: "#fce7cc",
              marginTop: 20,
              lineHeight: 1.2,
            }}
          >
            Plan theme park trips in minutes
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#dd4e14",
              marginTop: 20,
              opacity: 0.9,
            }}
          >
            300+ parks · 45 destinations · Trip-powered
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
