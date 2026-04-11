import { Resend } from "resend";

let resendSingleton: Resend | null = null;

export function getResend(): Resend {
  if (!resendSingleton) {
    resendSingleton = new Resend(process.env.RESEND_API_KEY ?? "");
  }
  return resendSingleton;
}

export const FROM_ADDRESS = "TripTiles <hello@triptiles.app>";
