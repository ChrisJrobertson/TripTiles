"use client";

import { useCallback, useEffect, useState } from "react";

/** Next.js / bundler message when the client bundle is stale vs deployed server actions. */
export const STALE_SERVER_ACTION_MESSAGE_SNIPPET = "was not found on the server";

export type ToastType = "info" | "success" | "error";

export type ToastPayload = {
  message: string;
  type: ToastType;
};

type Listener = (toast: ToastPayload | null) => void;

const listeners = new Set<Listener>();

let currentToast: ToastPayload | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
const debounceByKey = new Map<string, number>();

function broadcast() {
  for (const l of listeners) l(currentToast);
}

function errorMessageFromUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "";
}

/** True when a redeploy or stale tab likely broke the server-action reference. */
export function isStaleServerActionError(err: unknown): boolean {
  return errorMessageFromUnknown(err).includes(
    STALE_SERVER_ACTION_MESSAGE_SNIPPET,
  );
}

/**
 * If `err` is a stale server-action error, shows a refresh hint toast and returns true.
 * Use in `catch` blocks or after failed calls. For error UI without a toast host
 * (e.g. `global-error`), use {@link isStaleServerActionError} and show copy inline.
 */
export function notifyStaleServerActionIfNeeded(err: unknown): boolean {
  if (!isStaleServerActionError(err)) return false;
  showToast(
    "The page needs refreshing — please reload and try again.",
    { durationMs: 4500, type: "error" },
  );
  return true;
}

/** Imperative toast for non-component code paths (optional). */
export function showToast(
  message: string,
  options?:
    | number
    | {
        durationMs?: number;
        type?: ToastType;
        debounceKey?: string;
        debounceMs?: number;
      },
) {
  const type = typeof options === "object" ? (options.type ?? "info") : "info";
  const durationMs =
    typeof options === "number"
      ? options
      : options?.durationMs ?? (type === "error" ? 5000 : 2000);
  const debounceKey =
    typeof options === "object" ? options.debounceKey : undefined;
  const debounceMs =
    typeof options === "object" ? (options.debounceMs ?? 0) : 0;
  if (debounceKey) {
    const now = Date.now();
    const prev = debounceByKey.get(debounceKey);
    if (prev != null && now - prev < debounceMs) return;
    debounceByKey.set(debounceKey, now);
  }
  if (clearTimer) clearTimeout(clearTimer);
  currentToast = { message, type };
  broadcast();
  clearTimer = setTimeout(() => {
    currentToast = null;
    broadcast();
    clearTimer = null;
  }, durationMs);
}

/** Hook: subscribe to toasts + show(). */
export function useToast() {
  const [toast, setToast] = useState<ToastPayload | null>(currentToast);

  useEffect(() => {
    const listener: Listener = (payload) => setToast(payload);
    listeners.add(listener);
    setToast(currentToast);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const show = useCallback((msg: string, type: ToastType = "info") => {
    showToast(msg, { type });
  }, []);

  return { toast, show };
}
