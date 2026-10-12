"use client";

import { listTripBudgetItemsAction } from "@/actions/budget";
import { listTripChecklistItemsAction } from "@/actions/checklist";
import type { TripBudgetItem, TripChecklistItem } from "@/lib/types";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TripWorkspaceDataValue = {
  checklistItems: TripChecklistItem[] | null;
  budgetItems: TripBudgetItem[] | null;
  setChecklistItems: (items: TripChecklistItem[]) => void;
  setBudgetItems: (items: TripBudgetItem[]) => void;
};

const TripWorkspaceDataContext = createContext<TripWorkspaceDataValue | null>(
  null,
);

export function TripWorkspaceDataProvider({
  tripId,
  children,
}: {
  tripId: string;
  children: ReactNode;
}) {
  const [checklistItems, setChecklistItems] = useState<TripChecklistItem[] | null>(
    null,
  );
  const [budgetItems, setBudgetItems] = useState<TripBudgetItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChecklistItems(null);
    setBudgetItems(null);
    void Promise.all([
      listTripChecklistItemsAction(tripId),
      listTripBudgetItemsAction(tripId),
    ]).then(([checklistRes, budgetRes]) => {
      if (cancelled) return;
      if (checklistRes.ok) setChecklistItems(checklistRes.items);
      if (budgetRes.ok) setBudgetItems(budgetRes.items);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const value = useMemo(
    () => ({
      checklistItems,
      budgetItems,
      setChecklistItems,
      setBudgetItems,
    }),
    [checklistItems, budgetItems],
  );

  return (
    <TripWorkspaceDataContext.Provider value={value}>
      {children}
    </TripWorkspaceDataContext.Provider>
  );
}

export function useTripWorkspaceData(): TripWorkspaceDataValue {
  const value = useContext(TripWorkspaceDataContext);
  if (!value) {
    throw new Error("useTripWorkspaceData must be used within TripWorkspaceDataProvider");
  }
  return value;
}
