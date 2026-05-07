import { logoMarkImageResponse } from "@/lib/brand/logo-icon-response";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return logoMarkImageResponse(32);
}
