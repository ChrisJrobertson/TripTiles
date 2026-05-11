/**
 * Minimal JSON GET with timeout and optional retries for provider adapters.
 */

export type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit | undefined,
  options: FetchJsonOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 400;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeout);
        throw options.signal.reason;
      }
      options.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "TripTilesLiveWaitIngest/1.0 (+https://triptiles.app)",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      const retryable =
        attempt < retries &&
        (err instanceof TypeError ||
          (err instanceof Error && err.name === "AbortError") ||
          (err instanceof Error &&
            /HTTP 5\d\d/.test(err.message)));
      if (!retryable) throw err;
      await sleep(retryDelayMs * 2 ** attempt, options.signal);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
