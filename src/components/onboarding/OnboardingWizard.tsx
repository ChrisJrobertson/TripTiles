"use client";

import { TripCreationWizard } from "@/components/planner/TripCreationWizard";
import { Button } from "@/components/ui/Button";
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
    <div className="flex min-h-screen flex-col bg-tt-bg-soft/40">
      <TripCreationWizard
        regions={regions}
        parks={parks}
        includeWelcome
        firstName={firstName}
        variant="page"
        onCancel={goPlanner}
      />
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-2 text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goPlanner}
          className="font-normal underline decoration-tt-line underline-offset-2"
        >
          Skip, take me to the planner
        </Button>
      </div>
    </div>
  );
}
