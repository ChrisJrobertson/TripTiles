import { Resend } from "resend";

let resendSingleton: Resend | null = null;

export function getResend(): Resend {
  if (!resendSingleton) {
    resendSingleton = new Resend(process.env.RESEND_API_KEY ?? "");
  }
  return resendSingleton;
}

/** Transactional sender — must match a verified domain in Resend. */
export const FROM_ADDRESS = "TripTiles <noreply@triptiles.com>";
/** Where human replies to automated mail should land. */
export const REPLY_TO_HELLO = "hello@triptiles.com";
