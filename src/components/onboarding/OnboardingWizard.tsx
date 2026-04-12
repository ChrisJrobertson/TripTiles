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
    <TripCreationWizard
      regions={regions}
      parks={parks}
      includeWelcome
      firstName={firstName}
      variant="page"
      onCancel={goPlanner}
    />
  );
}
