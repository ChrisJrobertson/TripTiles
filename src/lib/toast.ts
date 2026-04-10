"use client";

import { useCallback, useEffect, useState } from "react";

type Listener = (message: string | null) => void;

const listeners = new Set<Listener>();

let currentMessage: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast() {
  for (const l of listeners) l(currentMessage);
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
