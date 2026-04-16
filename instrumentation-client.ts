// Client-side Sentry initialisation (Next.js App Router).
// Set NEXT_PUBLIC_SENTRY_DSN in production to enable reporting.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0.2 : 0.1,
});
