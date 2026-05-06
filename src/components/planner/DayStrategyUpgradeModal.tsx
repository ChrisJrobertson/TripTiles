"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";

const PRIMARY_LINK =
  "inline-flex min-h-12 flex-1 items-center justify-center rounded-tt-md bg-tt-royal px-4 py-3 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-royal-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export function DayStrategyUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    trackEvent("day_strategy_upgrade_modal_open", { source: "modal" });
  }, [open]);

  if (!open) return null;
  return (
    <ModalShell
      zClassName="z-[110]"
      bottomSheetOnMobile
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      panelClassName="p-6"
      role="dialog"
      aria-modal={true}
      aria-labelledby="day-strategy-upgrade-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <h2
        id="day-strategy-upgrade-title"
        className="font-heading text-xl font-semibold text-tt-royal"
      >
        Unlock AI Day Strategy ✨
      </h2>
      <p className="mt-4 font-sans text-sm leading-relaxed text-tt-royal/85">
        Get sequenced ride plans that factor in:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-tt-royal/85">
        <li>Lightning Lane Multi Pass strategy</li>
        <li>Universal Express Pass timing</li>
        <li>Single Rider lane recommendations</li>
        <li>Child height restrictions</li>
        <li>Optimal walking order between rides</li>
      </ul>
      <p className="mt-4 font-sans text-sm text-tt-royal/75">
        This is a Pro feature designed for families who want to make every park
        hour count.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/pricing"
          className={PRIMARY_LINK}
          onClick={() => {
            trackEvent("day_strategy_upgrade_cta", { target: "/pricing" });
            onClose();
          }}
        >
          Upgrade to Pro — £6.99/mo
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 flex-1"
          onClick={onClose}
        >
          Maybe later
        </Button>
      </div>
    </ModalShell>
  );
}
