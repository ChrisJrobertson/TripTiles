"use client";

import { TripTilesSpinningMark } from "@/components/brand/TripTilesSpinningMark";

export default function MarketingSegmentLoading() {
  return (
    <div className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-4 bg-transparent px-4 py-16">
      <TripTilesSpinningMark size="lg" />
      <p className="max-w-sm text-center font-serif text-lg font-semibold text-royal">
        Loading…
      </p>
      <p className="max-w-xs text-center font-sans text-sm text-royal/60">
        Almost there.
      </p>
    </div>
  );
}
