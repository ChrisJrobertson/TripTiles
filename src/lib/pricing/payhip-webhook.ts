import { createHash } from "node:crypto";

/**
 * Payhip sends a `signature` field on webhook JSON. Per Payhip docs, it matches
 * SHA-256 of your API key from Settings → Developer (same value as
 * `PAYHIP_WEBHOOK_SECRET` in `.env.local`).
 */
export function verifyPayhipWebhookSignature(
  body: unknown,
  payhipApiKey: string,
): boolean {
  if (!body || typeof body !== "object") return false;
  const sig = (body as { signature?: string }).signature;
  if (typeof sig !== "string" || !sig) return false;
  const expected = createHash("sha256").update(payhipApiKey).digest("hex");
  return sig === expected;
}
