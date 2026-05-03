export type TierErrorCode =
  | "TIER_LIMIT_TRIPS"
  | "TIER_AI_DISABLED"
  | "TIER_PUBLIC_SHARE_DISABLED";

export class TierError extends Error {
  readonly code: TierErrorCode;

  constructor(code: TierErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TierError";
    this.code = code;
  }
}
