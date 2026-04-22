"use client";

import { TripTilesLoadingOverlay } from "@/components/brand/TripTilesLoadingOverlay";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type GlobalLoadingValue = {
  /** Increment loading depth and set the headline copy. */
  begin: (message?: string) => void;
  /** Decrement depth (never below zero). */
  end: () => void;
  /** Runs `fn` between begin/end with the given message. */
  withLoading: <T,>(message: string, fn: () => Promise<T>) => Promise<T>;
  /** True while any nested `begin` has not been matched by `end`. */
  busy: boolean;
};

const noopApi: GlobalLoadingValue = {
  begin: () => {},
  end: () => {},
  withLoading: async <T,>(_message: string, fn: () => Promise<T>) => fn(),
  busy: false,
};

const GlobalLoadingContext = createContext<GlobalLoadingValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);
  const [message, setMessage] = useState("Loading…");

  const begin = useCallback((msg = "Loading…") => {
    setMessage(msg);
    setDepth((d) => d + 1);
  }, []);

  const end = useCallback(() => {
    setDepth((d) => Math.max(0, d - 1));
  }, []);

  const withLoading = useCallback(
    async <T,>(msg: string, fn: () => Promise<T>): Promise<T> => {
      begin(msg);
      try {
        return await fn();
      } finally {
        end();
      }
    },
    [begin, end],
  );

  const busy = depth > 0;

  const value = useMemo(
    () => ({ begin, end, withLoading, busy }),
    [begin, end, withLoading, busy],
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <TripTilesLoadingOverlay
        open={busy}
        title={message}
        caption="This only takes a moment."
        tone="light"
      />
    </GlobalLoadingContext.Provider>
  );
}

/** Branded full-screen loading — use `begin` / `end` or `withLoading` around async work. */
export function useGlobalLoading(): GlobalLoadingValue {
  const ctx = useContext(GlobalLoadingContext);
  return ctx ?? noopApi;
}
