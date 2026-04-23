"use client";

import { TripCreationWizard } from "@/components/planner/TripCreationWizard";
import type { Park, Region } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Props = {
  firstName: string;
  regions: Region[];
  parks: Park[];
};

export function OnboardingWizard({ firstName, regions, parks }: Props) {
  const router = useRouter();

  const goPlanner = useCallback(() => {
    router.push("/planner");
    router.refresh();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <TripCreationWizard
        regions={regions}
        parks={parks}
        includeWelcome
        firstName={firstName}
        variant="page"
        onCancel={goPlanner}
      />
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-2 text-center">
        <button
          type="button"
          onClick={goPlanner}
          className="min-h-11 min-w-[44px] rounded-sm px-2 font-sans text-sm text-royal underline decoration-royal/40 underline-offset-2 transition hover:text-gold hover:decoration-gold/60"
        >
          Skip, take me to the planner
        </button>
      </div>
    </div>
  );
}
