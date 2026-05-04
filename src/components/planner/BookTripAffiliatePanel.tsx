"use client";

import { buildAffiliateUrl } from "@/lib/affiliates";

type Props = {
  destinationLabel: string;
  tripId: string;
  startDate: string;
  endDate: string;
  siteUrl: string;
};

export function BookTripAffiliatePanel({
  destinationLabel,
  tripId,
  startDate,
  endDate,
  siteUrl,
}: Props) {
  /** Post-launch: set `NEXT_PUBLIC_AFFILIATES_ENABLED=true` when real partner IDs exist. */
  if (process.env.NEXT_PUBLIC_AFFILIATES_ENABLED !== "true") {
    return null;
  }

  const base = siteUrl.replace(/\/$/, "");

  const hotelsPath = buildAffiliateUrl({
    provider: "booking",
    productType: "hotel",
    destinationName: destinationLabel,
    checkIn: startDate,
    checkOut: endDate,
    tripId,
  });
  const gygPath = buildAffiliateUrl({
    provider: "getyourguide",
    productType: "experience",
    destinationName: destinationLabel,
    searchQuery: `${destinationLabel} tours and tickets`,
    tripId,
  });
  const carsPath = buildAffiliateUrl({
    provider: "booking",
    productType: "other",
    destinationName: `${destinationLabel} car rental`,
    searchQuery: `car rental ${destinationLabel}`,
    tripId,
  });

  const links = [
    { label: `Find hotels in ${destinationLabel}`, href: `${base}${hotelsPath}` },
    {
      label: `Book ${destinationLabel} experiences`,
      href: `${base}${gygPath}`,
    },
    {
      label: `Compare rental cars near ${destinationLabel}`,
      href: `${base}${carsPath}`,
    },
  ];

  return (
    <aside
      className="rounded-xl border border-royal/10 border-l-[3px] border-l-gold bg-cream/90 pl-4 pr-3 py-3 shadow-sm"
      aria-label="Booking partners"
    >
      <p className="font-serif text-sm font-semibold text-royal">Ready to book?</p>
      <p className="mt-1 font-sans text-xs text-royal/65">
        Support TripTiles at no extra cost when you book through these links.
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              className="font-sans text-sm text-royal/85 underline-offset-2 transition hover:text-royal hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
