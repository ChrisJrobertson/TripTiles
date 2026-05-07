"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/**
 * PlannerStateContext — **Option A (pre-launch)**.
 *
 * Owns lightweight UI slices that must stay aligned across planner subtrees:
 * `plannerTimelineDateKey` (selected day on the inline timeline) and `selectedParkId`.
 *
 * **`trips`, `activeTripId`,** and heavy planner payloads remain in `PlannerClient` local state.
 * Lifting trips into context is an explicit deferred migration (post-launch), not hidden scope creep.
 */

export type PlannerStateValue = {
  plannerTimelineDateKey: string | null;
  setPlannerTimelineDateKey: Dispatch<SetStateAction<string | null>>;
  selectedParkId: string | null;
  setSelectedParkId: Dispatch<SetStateAction<string | null>>;
};

const PlannerStateContext = createContext<PlannerStateValue | null>(null);

export function PlannerStateProvider({ children }: { children: ReactNode }) {
  const [plannerTimelineDateKey, setPlannerTimelineDateKey] = useState<
    string | null
  >(null);
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      plannerTimelineDateKey,
      setPlannerTimelineDateKey,
      selectedParkId,
      setSelectedParkId,
    }),
    [plannerTimelineDateKey, selectedParkId],
  );

  return (
    <PlannerStateContext.Provider value={value}>
      {children}
    </PlannerStateContext.Provider>
  );
}

export function usePlannerState(): PlannerStateValue {
  const ctx = useContext(PlannerStateContext);
  if (!ctx) {
    throw new Error("usePlannerState must be used within PlannerStateProvider");
  }
  return ctx;
}
