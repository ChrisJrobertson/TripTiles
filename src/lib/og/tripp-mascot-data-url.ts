import { readFileSync } from "node:fs";
import path from "node:path";

let cache: string | null = null;

/** Base64 data URL for the transparent Tripp mascot (Open Graph / ImageResponse). */
export function getTrippMascotDataUrl(): string {
  if (cache) return cache;
  const file = path.join(
    process.cwd(),
    "public",
    "images",
    "tripp-mascot.png",
  );
  const buf = readFileSync(file);
  cache = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  return cache;
}
