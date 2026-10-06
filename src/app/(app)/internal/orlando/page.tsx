import { isInternalStaffEmail } from "@/lib/auth/internal-staff";
import { requireAuth } from "@/lib/auth/redirects";
import { loadOrlandoCoverage } from "@/lib/park-data/load-orlando-coverage";
import {
  ORLANDO_HEADLINE_PARK_IDS,
  ORLANDO_PARK_IDENTITIES,
} from "@/lib/park-data/orlando-parks";
import type { CoverageStatus, OrlandoParkReport } from "@/lib/park-data/orlando-report";
import { readProviderPolicy } from "@/lib/park-data/registry";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orlando coverage · TripTiles",
  robots: { index: false, follow: false },
};

function statusClass(status: CoverageStatus | string): string {
  if (status === "complete" || status === "LIVE") return "text-emerald-800";
  if (status === "partial" || status === "RECENT") return "text-amber-800";
  if (status === "conflicting" || status === "STALE") return "text-rose-800";
  return "text-royal/70";
}

function CoverageTable({ parks }: { parks: OrlandoParkReport[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-gold/40 text-[10px] uppercase tracking-wide text-royal/60">
            <th className="px-2 py-2">Park</th>
            <th className="px-2 py-2">ThemeParks.wiki</th>
            <th className="px-2 py-2">Queue-Times</th>
            <th className="px-2 py-2">Attractions</th>
            <th className="px-2 py-2">Primary mapped</th>
            <th className="px-2 py-2">Fallback mapped</th>
            <th className="px-2 py-2">Unmapped</th>
            <th className="px-2 py-2">Live rows</th>
            <th className="px-2 py-2">Freshness</th>
            <th className="px-2 py-2">Schedule</th>
            <th className="px-2 py-2">Conflicts</th>
            <th className="px-2 py-2">Last success</th>
            <th className="px-2 py-2">Last error</th>
          </tr>
        </thead>
        <tbody>
          {parks.map((park) => (
            <tr key={park.parkId} className="border-b border-royal/10 align-top">
              <td className="px-2 py-2 font-medium">
                {park.canonicalName}
                <div className="font-mono text-[10px] text-royal/50">{park.parkId}</div>
              </td>
              <td className={`px-2 py-2 ${statusClass(park.themeParksWiki)}`}>{park.themeParksWiki}</td>
              <td className={`px-2 py-2 ${statusClass(park.queueTimes)}`}>{park.queueTimes}</td>
              <td className="px-2 py-2">{park.attractionCount}</td>
              <td className="px-2 py-2">{park.mappedToPrimary}</td>
              <td className="px-2 py-2">{park.mappedToFallback}</td>
              <td className="px-2 py-2">{park.unmapped}</td>
              <td className="px-2 py-2">{park.liveObservations}</td>
              <td className={`px-2 py-2 ${statusClass(park.liveFreshness)}`}>{park.liveFreshness}</td>
              <td className={`px-2 py-2 ${statusClass(park.schedule)}`}>{park.schedule}</td>
              <td className="px-2 py-2">{park.conflicts.join("; ") || "—"}</td>
              <td className="px-2 py-2">{park.lastSuccessAt ?? "—"}</td>
              <td className="px-2 py-2">{park.lastError ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function InternalOrlandoCoveragePage() {
  const user = await requireAuth("/internal/orlando");
  if (!isInternalStaffEmail(user.email)) notFound();

  const policy = readProviderPolicy();
  let configError: string | null = null;
  let warnings: string[] = [];
  let parks: OrlandoParkReport[] = [];
  let summary = "missing";

  try {
    const loaded = await loadOrlandoCoverage(createServiceRoleClient());
    parks = loaded.report.parks;
    summary = loaded.report.summary;
    warnings = loaded.warnings;
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }

  const headline = parks.filter((park) => park.headline);
  const extra = parks.filter((park) => !park.headline);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans text-sm text-royal">
      <p className="text-xs">
        <Link href="/internal/live-wait" className="underline decoration-gold/50">
          Live wait mapping
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-2xl font-semibold">Orlando coverage</h1>
      <p className="mt-2 max-w-3xl text-royal/70">
        Internal diagnostics for the Orlando intelligence foundation. Signed in as{" "}
        <span className="font-medium">{user.email}</span>. Provider ids below are staff-only.
        Missing values stay missing. Primary provider:{" "}
        <span className="font-mono">{policy.legacySingleProvider ?? policy.primary}</span>
        {policy.legacySingleProvider
          ? " (LIVE_WAIT_PROVIDER forces a single provider)."
          : ` · fallback ${policy.fallback ?? "none"}.`}
      </p>
      <p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${statusClass(summary)}`}>
        Headline field summary: {summary}
      </p>

      {configError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <p className="font-semibold">Database coverage unavailable</p>
          <p className="mt-1 font-mono text-xs">{configError}</p>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-4 list-disc pl-5 text-xs text-amber-900">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <section className="mt-8">
        <h2 className="font-serif text-xl">Headline parks</h2>
        <CoverageTable parks={headline} />
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-xl">Other represented parks</h2>
        <CoverageTable parks={extra} />
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl">Confirmed provider identities</h2>
        <p className="mt-2 text-xs text-royal/70">
          Taken from ThemeParks.wiki and Queue-Times on 2026-10-06. These ids are not name-matched at runtime.
          Headline ids: {ORLANDO_HEADLINE_PARK_IDS.join(", ")}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gold/40 text-[10px] uppercase tracking-wide text-royal/60">
                <th className="px-2 py-2">Park</th>
                <th className="px-2 py-2">ThemeParks.wiki id</th>
                <th className="px-2 py-2">Queue-Times id</th>
                <th className="px-2 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {ORLANDO_PARK_IDENTITIES.map((park) => (
                <tr key={park.parkId} className="border-b border-royal/10 align-top">
                  <td className="px-2 py-2">
                    {park.canonicalName}
                    <div className="font-mono text-[10px] text-royal/50">{park.parkId}</div>
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">{park.themeParksWikiId ?? "unsupported"}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {park.queueTimesSupport === "unsupported"
                      ? "unsupported"
                      : park.queueTimesId}
                  </td>
                  <td className="px-2 py-2 text-royal/70">{park.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl">Unmapped live attractions</h2>
        <p className="mt-2 text-xs text-royal/70">
          Rows with a park link and no TripTiles attraction id. Ambiguous names are not mapped from here.
        </p>
        <ul className="mt-3 space-y-2 text-xs">
          {parks.flatMap((park) =>
            park.unmappedAttractions.map((row) => (
              <li key={`${row.provider}-${row.externalParkId}-${row.externalAttractionId}`}>
                <span className="font-medium">{park.canonicalName}</span> · {row.provider} ·{" "}
                {row.externalName ?? "unnamed"} ·{" "}
                <span className="font-mono">{row.externalAttractionId}</span>
              </li>
            )),
          )}
          {parks.every((park) => park.unmappedAttractions.length === 0) ? (
            <li className="text-royal/60">No unmapped live rows are stored for these parks.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl">Field gaps</h2>
        {headline.map((park) => (
          <details key={park.parkId} className="mt-3 rounded-lg border border-gold/30 bg-cream/40 p-3">
            <summary className="cursor-pointer font-medium">{park.canonicalName}</summary>
            <ul className="mt-2 space-y-1 text-xs">
              {park.fields
                .filter((item) => item.status !== "complete")
                .map((item) => (
                  <li key={item.field}>
                    <span className={`font-semibold ${statusClass(item.status)}`}>{item.status}</span>{" "}
                    <span className="font-mono">{item.field}</span> — {item.detail}
                  </li>
                ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
}
