export interface AffiliateProvider {
  id: "booking" | "getyourguide" | "amazon";
  name: string;
  baseUrl: string;
}

export interface AffiliateLinkOptions {
  provider: "booking" | "getyourguide" | "amazon";
  productType: "hotel" | "experience" | "ticket" | "other";
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  checkIn?: string;
  checkOut?: string;
  searchQuery?: string;
  tileId?: string;
  tripId?: string;
}

export function buildAffiliateUrl(opts: AffiliateLinkOptions): string {
  const params = new URLSearchParams({
    provider: opts.provider,
    type: opts.productType,
  });
  if (opts.destinationName) params.set("dest", opts.destinationName);
  if (opts.searchQuery) params.set("q", opts.searchQuery);
  if (opts.checkIn) params.set("ci", opts.checkIn);
  if (opts.checkOut) params.set("co", opts.checkOut);
  if (opts.tileId) params.set("tile", opts.tileId);
  if (opts.tripId) params.set("trip", opts.tripId);
  return `/api/affiliate/click?${params.toString()}`;
}

export function buildBookingDeepLink(opts: {
  destinationName: string;
  checkIn?: string;
  checkOut?: string;
  aid: string;
}): string {
  const params = new URLSearchParams({
    ss: opts.destinationName,
    aid: opts.aid,
  });
  if (opts.checkIn) params.set("checkin", opts.checkIn);
  if (opts.checkOut) params.set("checkout", opts.checkOut);
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function buildGetYourGuideDeepLink(opts: {
  searchQuery: string;
  partnerId: string;
}): string {
  const params = new URLSearchParams({
    q: opts.searchQuery,
    partner_id: opts.partnerId,
  });
  return `https://www.getyourguide.com/s/?${params.toString()}`;
}

export function hasRealBookingPartnerId(): boolean {
  const id = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID?.trim();
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id !== "placeholder" &&
    id !== "TODO" &&
    !id.toUpperCase().startsWith("TEST")
  );
}

export function hasRealGygPartnerId(): boolean {
  const id = process.env.NEXT_PUBLIC_GYG_PARTNER_ID?.trim();
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id !== "placeholder" &&
    id !== "TODO" &&
    !id.toUpperCase().startsWith("TEST")
  );
}

export function hasAnyAffiliatePartner(): boolean {
  return hasRealBookingPartnerId() || hasRealGygPartnerId();
}

export function resolveProviderUrl(opts: AffiliateLinkOptions): string {
  const bookingAid =
    process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID ?? "placeholder";
  const gygPartner =
    process.env.NEXT_PUBLIC_GYG_PARTNER_ID ?? "placeholder";

  switch (opts.provider) {
    case "booking":
      if (!hasRealBookingPartnerId()) {
        return "https://www.booking.com/";
      }
      return buildBookingDeepLink({
        destinationName: opts.destinationName ?? "Orlando",
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        aid: bookingAid,
      });
    case "getyourguide":
      if (!hasRealGygPartnerId()) {
        return "https://www.getyourguide.com/";
      }
      return buildGetYourGuideDeepLink({
        searchQuery:
          opts.searchQuery ?? opts.destinationName ?? "theme park tickets",
        partnerId: gygPartner,
      });
    case "amazon": {
      const q = opts.searchQuery ?? "";
      return `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`;
    }
    default:
      return "https://www.triptiles.app";
  }
}
