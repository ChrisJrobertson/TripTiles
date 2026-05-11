import { isInternalStaffEmail } from "@/lib/auth/internal-staff";
import { requireAuth } from "@/lib/auth/redirects";
import { buildLiveWaitMappingDiagnostics } from "@/lib/live-wait/mapping-diagnostics";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live wait mapping · TripTiles",
  robots: { index: false, follow: false },
};

export default async function InternalLiveWaitDiagnosticsPage() {
  const user = await requireAuth("/internal/live-wait");
  if (!isInternalStaffEmail(user.email)) {
    notFound();
  }

  let configError: string | null = null;
  let diagnostics: Awaited<
    ReturnType<typeof buildLiveWaitMappingDiagnostics>
  > | null = null;
  let mappedSample: Record<string, unknown>[] | null = null;

  try {
    const supabase = createServiceRoleClient();
    diagnostics = await buildLiveWaitMappingDiagnostics(supabase, {
      provider: "queue_times",
      maxRows: 200,
    });
    const { data, error } = await supabase
      .from("live_wait_provider_mappings")
      .select(
        "provider, external_park_id, external_attraction_id, park_id, attraction_id, external_name, mapping_confidence",
      )
      .eq("provider", "queue_times")
      .not("attraction_id", "is", null)
      .order("park_id", { ascending: true })
      .limit(120);

    if (error) throw new Error(error.message);
    mappedSample = (data ?? []) as Record<string, unknown>[];
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans text-sm text-royal">
      <h1 className="font-serif text-2xl font-semibold text-royal">
        Live wait — internal mapping diagnostics
      </h1>
      <p className="mt-2 text-royal/70">
        Signed in as <span className="font-medium">{user.email}</span>. Provider
        identifiers are not exposed on public TripTiles routes.
      </p>

      {configError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <p className="font-semibold">Configuration error</p>
          <p className="mt-1 font-mono text-xs">{configError}</p>
        </div>
      ) : null}

      {diagnostics ? (
        <>
          {diagnostics.truncated ? (
            <p className="mt-4 text-xs text-royal/60">
              Showing first 200 unmapped current rows — list is truncated.
            </p>
          ) : null}

          <section className="mt-8">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
              Unmapped provider rides (live_wait_current)
            </h2>
            <p className="mt-1 text-xs text-royal/60">
              Suggestions use token overlap on attractions in the same TripTiles
              park only when a park-level row exists in{" "}
              <code className="rounded bg-cream px-1">live_wait_provider_mappings</code>.
            </p>

            <div className="mt-4 space-y-8">
              {diagnostics.groups.length === 0 ? (
                <p className="text-sm text-royal/60">
                  No unmapped rows in live_wait_current for this provider.
                </p>
              ) : null}
              {diagnostics.groups.map((g) => (
                <div key={g.externalParkId} className="rounded-xl border border-royal/12 bg-white p-4">
                  <p className="font-semibold text-royal">
                    External park {g.externalParkId}
                    {g.internalParkName ? (
                      <span className="font-normal text-royal/70">
                        {" "}
                        → TripTiles park: {g.internalParkName}{" "}
                        <code className="text-xs">({g.internalParkId})</code>
                      </span>
                    ) : (
                      <span className="text-royal/60">
                        {" "}
                        — add a park-level mapping first (SQL below).
                      </span>
                    )}
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-royal/15 text-royal/60">
                          <th className="py-2 pr-2">External ride id</th>
                          <th className="py-2 pr-2">Name</th>
                          <th className="py-2 pr-2">Wait</th>
                          <th className="py-2 pr-2">Status</th>
                          <th className="py-2 pr-2">Observed</th>
                          <th className="py-2">Suggested attractions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr
                            key={`${g.externalParkId}-${r.externalAttractionId}`}
                            className="border-b border-royal/10"
                          >
                            <td className="py-2 pr-2 font-mono">{r.externalAttractionId}</td>
                            <td className="py-2 pr-2">{r.externalName ?? "—"}</td>
                            <td className="py-2 pr-2">
                              {r.waitMinutes != null ? `${r.waitMinutes} min` : "—"}
                            </td>
                            <td className="py-2 pr-2">{r.operatingStatus}</td>
                            <td className="py-2 pr-2 whitespace-nowrap">
                              {r.observedAt ? new Date(r.observedAt).toLocaleString() : "—"}
                            </td>
                            <td className="py-2 align-top">
                              {r.suggestions.length === 0 ? (
                                <span className="text-royal/50">—</span>
                              ) : (
                                <ul className="list-inside list-disc space-y-0.5">
                                  {r.suggestions.map((s) => (
                                    <li key={s.attractionId}>
                                      {s.name}{" "}
                                      <span className="text-royal/50">
                                        ({Math.round(s.score * 100)}% match)
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
              Mapped attractions (sample)
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-royal/15 text-royal/60">
                    <th className="py-2 pr-2">park_id</th>
                    <th className="py-2 pr-2">attraction_id</th>
                    <th className="py-2 pr-2">external park</th>
                    <th className="py-2 pr-2">external ride</th>
                    <th className="py-2">external_name</th>
                  </tr>
                </thead>
                <tbody>
                  {(mappedSample ?? []).map((m, i) => (
                    <tr key={i} className="border-b border-royal/10">
                      <td className="py-2 pr-2 font-mono">{String(m.park_id ?? "")}</td>
                      <td className="py-2 pr-2 font-mono">{String(m.attraction_id ?? "")}</td>
                      <td className="py-2 pr-2 font-mono">
                        {String(m.external_park_id ?? "")}
                      </td>
                      <td className="py-2 pr-2 font-mono">
                        {String(m.external_attraction_id ?? "")}
                      </td>
                      <td className="py-2">{String(m.external_name ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-10 rounded-xl border border-gold/30 bg-cream/40 p-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal">
          SQL-assisted mapping (no in-app write yet)
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-royal/75">
          Insert or upsert into{" "}
          <code className="rounded bg-white px-1">live_wait_provider_mappings</code> using
          provider <code className="rounded bg-white px-1">queue_times</code>, external ids from
          this page, and TripTiles <code className="rounded bg-white px-1">park_id</code> /{" "}
          <code className="rounded bg-white px-1">attraction_id</code> from your catalogue. Copy
          patterns from <code className="rounded bg-white px-1">supabase/sql/live_wait_ops_monitoring.sql</code>.
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
