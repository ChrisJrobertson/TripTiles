import { isInternalStaffEmail } from "@/lib/auth/internal-staff";
import { requireAuth } from "@/lib/auth/redirects";
import { InternalLiveWaitMappingConsole } from "@/components/live-wait/InternalLiveWaitMappingConsole";
import {
  buildLiveWaitMappingConsoleDiagnostics,
  type LiveWaitMappingConsoleDiagnostics,
} from "@/lib/live-wait/mapping-diagnostics";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live wait mapping · TripTiles",
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseMode(value: string | null): "unmapped" | "mapped" | "all" {
  return value === "mapped" || value === "all" ? value : "unmapped";
}

export default async function InternalLiveWaitDiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth("/internal/live-wait");
  if (!isInternalStaffEmail(user.email)) {
    notFound();
  }

  const sp = await searchParams;
  let configError: string | null = null;
  let diagnostics: LiveWaitMappingConsoleDiagnostics | null = null;

  try {
    const supabase = createServiceRoleClient();
    diagnostics = await buildLiveWaitMappingConsoleDiagnostics(supabase, {
      provider: firstParam(sp.provider) ?? "queue_times",
      externalParkId: firstParam(sp.externalParkId),
      internalParkId: firstParam(sp.parkId),
      query: firstParam(sp.q),
      mode: parseMode(firstParam(sp.mode)),
      maxRows: 500,
    });
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans text-sm text-royal">
      <h1 className="font-serif text-2xl font-semibold text-royal">
        Live wait — mapping console
      </h1>
      <p className="mt-2 text-royal/70">
        Signed in as <span className="font-medium">{user.email}</span>. Provider
        identifiers stay inside this internal route and the protected mapping action.
      </p>

      {configError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <p className="font-semibold">Configuration error</p>
          <p className="mt-1 font-mono text-xs">{configError}</p>
        </div>
      ) : null}

      {diagnostics ? (
        <div className="mt-8">
          <InternalLiveWaitMappingConsole diagnostics={diagnostics} />
        </div>
      ) : null}

      <section className="mt-10 rounded-xl border border-gold/30 bg-cream/40 p-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal">
          SQL-assisted fallback
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-royal/75">
          The buttons above run a staff-only service-role upsert with validation. If the
          action is unavailable, use the per-row SQL snippets or the monitoring playbook
          in{" "}
          <code className="rounded bg-white px-1">
            supabase/sql/live_wait_ops_monitoring.sql
          </code>
          .
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-royal">
            Example: upsert one ride mapping
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-royal">
{`insert into live_wait_provider_mappings (
  provider, external_park_id, external_attraction_id,
  park_id, attraction_id, external_name, mapping_confidence
) values (
  'queue_times',
  '6',
  '138',
  'YOUR_TRIPTILES_PARK_ID',
  'YOUR_TRIPTILES_ATTRACTION_ID',
  'Space Mountain',
  1.0
)
on conflict (provider, external_park_id, external_attraction_id)
do update set
  park_id = excluded.park_id,
  attraction_id = excluded.attraction_id,
  external_name = excluded.external_name,
  mapping_confidence = excluded.mapping_confidence,
  updated_at = now();`}
          </pre>
        </details>
      </section>
    </div>
  );
}
