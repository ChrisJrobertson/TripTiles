import { logoMarkSvgDataUrl } from "@/lib/brand/logo-svg-data-url";
import { ImageResponse } from "next/og";

/** Icon-only raster for `app/icon`, `brand-icon/[px]`, and `apple-icon` routes (Satori + data-URL SVG). */
export function logoMarkImageResponse(px: number) {
  const src = logoMarkSvgDataUrl();
  const inner = Math.max(2, px - 4);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
