"use client";

import { useCallback, useEffect, useState } from "react";

/** Next.js / bundler message when the client bundle is stale vs deployed server actions. */
export const STALE_SERVER_ACTION_MESSAGE_SNIPPET = "was not found on the server";

type Listener = (message: string | null) => void;

const listeners = new Set<Listener>();

let currentMessage: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast() {
  for (const l of listeners) l(currentMessage);
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
    4500,
  );
  return true;
}

/** Imperative toast for non-component code paths (optional). */
export function showToast(message: string, durationMs = 3000) {
  if (clearTimer) clearTimeout(clearTimer);
  currentMessage = message;
  broadcast();
  clearTimer = setTimeout(() => {
    currentMessage = null;
    broadcast();
    clearTimer = null;
  }, durationMs);
}

/** Hook: subscribe to toasts + show(). */
export function useToast() {
  const [message, setMessage] = useState<string | null>(currentMessage);

  useEffect(() => {
    const listener: Listener = (m) => setMessage(m);
    listeners.add(listener);
    setMessage(currentMessage);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const show = useCallback((msg: string) => {
    showToast(msg);
  }, []);

  return { message, show };
}
