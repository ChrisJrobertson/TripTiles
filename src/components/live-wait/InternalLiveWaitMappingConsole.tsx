"use client";

import { upsertLiveWaitProviderMappingAction } from "@/actions/internal-live-wait";
import { Button, Card, EmptyState } from "@/components/ui";
import type {
  LiveWaitMappingConsoleDiagnostics,
  LiveWaitMappingConsoleRow,
} from "@/lib/live-wait/mapping-diagnostics";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  diagnostics: LiveWaitMappingConsoleDiagnostics;
};

function confidenceLabel(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function shortDateTime(iso: string): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusText(row: LiveWaitMappingConsoleRow): string {
  const wait = row.waitMinutes == null ? "wait unknown" : `${row.waitMinutes} min`;
  return `${row.operatingStatus} · ${wait}`;
}

function buildRideSql(row: LiveWaitMappingConsoleRow): string {
  const suggestion = row.suggestions[0];
  if (!row.suggestedParkId || !suggestion) {
    return "-- Select an internal park to generate a ride mapping statement.";
  }

  const externalName = (row.externalName ?? "").replaceAll("'", "''");
  return `insert into live_wait_provider_mappings (
  provider, external_park_id, external_attraction_id,
  park_id, attraction_id, external_name, mapping_confidence
) values (
  '${row.provider.replaceAll("'", "''")}',
  '${row.externalParkId.replaceAll("'", "''")}',
  '${row.externalAttractionId.replaceAll("'", "''")}',
  '${row.suggestedParkId.replaceAll("'", "''")}',
  '${suggestion.attractionId.replaceAll("'", "''")}',
  '${externalName}',
  ${suggestion.score.toFixed(3)}
)
on conflict (provider, external_park_id, external_attraction_id)
do update set
  park_id = excluded.park_id,
  attraction_id = excluded.attraction_id,
  external_name = excluded.external_name,
  mapping_confidence = excluded.mapping_confidence,
  updated_at = now();`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-royal/55">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-semibold text-royal">{value}</p>
    </Card>
  );
}

export function InternalLiveWaitMappingConsole({ diagnostics }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const externalParkFilter = diagnostics.filters.externalParkId ?? "";
  const internalParkFilter = diagnostics.filters.internalParkId ?? "";
  const selectedParkName = useMemo(
    () =>
      diagnostics.parkOptions.find((park) => park.id === internalParkFilter)?.name ??
      null,
    [diagnostics.parkOptions, internalParkFilter],
  );

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    const provider = String(formData.get("provider") ?? "").trim();
    const externalParkId = String(formData.get("externalParkId") ?? "").trim();
    const internalParkId = String(formData.get("internalParkId") ?? "").trim();
    const mode = String(formData.get("mode") ?? "").trim();
    const q = String(formData.get("q") ?? "").trim();

    if (provider && provider !== "queue_times") params.set("provider", provider);
    if (externalParkId) params.set("externalParkId", externalParkId);
    if (internalParkId) params.set("parkId", internalParkId);
    if (mode && mode !== "unmapped") params.set("mode", mode);
    if (q) params.set("q", q);

    router.push(`/internal/live-wait${params.toString() ? `?${params}` : ""}`);
  }

  function saveParkMapping() {
    if (!externalParkFilter || !internalParkFilter) {
      setMessage("Choose both an external park and a TripTiles park first.");
      return;
    }

    startTransition(async () => {
      const result = await upsertLiveWaitProviderMappingAction({
        provider: diagnostics.provider,
        externalParkId: externalParkFilter,
        externalAttractionId: "",
        parkId: internalParkFilter,
        attractionId: null,
        externalName: `Park-level mapping for external park ${externalParkFilter}`,
        mappingConfidence: 1,
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function saveRideMapping(row: LiveWaitMappingConsoleRow, attractionId: string) {
    const suggestion = row.suggestions.find(
      (candidate) => candidate.attractionId === attractionId,
    );
    if (!row.suggestedParkId || !suggestion) {
      setMessage("Choose an internal park and suggestion first.");
      return;
    }

    startTransition(async () => {
      const result = await upsertLiveWaitProviderMappingAction({
        provider: row.provider,
        externalParkId: row.externalParkId,
        externalAttractionId: row.externalAttractionId,
        parkId: row.suggestedParkId!,
        attractionId: suggestion.attractionId,
        externalName: row.externalName,
        mappingConfidence: Number(suggestion.score.toFixed(3)),
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Unmapped rows" value={diagnostics.stats.unmappedRows} />
        <StatCard label="Mapped rows" value={diagnostics.stats.mappedRows} />
        <StatCard
          label="High confidence"
          value={diagnostics.stats.highConfidenceSuggestions}
        />
        <StatCard label="Ambiguous" value={diagnostics.stats.ambiguousSuggestions} />
        <StatCard label="No candidate" value={diagnostics.stats.noCandidateRows} />
      </section>

      <Card className="p-4">
        <form action={applyFilters} className="grid gap-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-semibold text-royal">
            Provider
            <input
              name="provider"
              defaultValue={diagnostics.provider}
              className="min-h-10 rounded-lg border border-royal/15 px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-royal">
            External park
            <select
              name="externalParkId"
              defaultValue={externalParkFilter}
              className="min-h-10 rounded-lg border border-royal/15 px-3 text-sm"
            >
              <option value="">All parks</option>
              {diagnostics.externalParkIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-royal">
            TripTiles park
            <select
              name="internalParkId"
              defaultValue={internalParkFilter}
              className="min-h-10 rounded-lg border border-royal/15 px-3 text-sm"
            >
              <option value="">Use saved park link</option>
              {diagnostics.parkOptions.map((park) => (
                <option key={park.id} value={park.id}>
                  {park.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-royal">
            Rows
            <select
              name="mode"
              defaultValue={diagnostics.filters.mode}
              className="min-h-10 rounded-lg border border-royal/15 px-3 text-sm"
            >
              <option value="unmapped">Unmapped first</option>
              <option value="mapped">Mapped only</option>
              <option value="all">All rows</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-royal">
            Search
            <input
              name="q"
              defaultValue={diagnostics.filters.query}
              placeholder="Ride or attraction"
              className="min-h-10 rounded-lg border border-royal/15 px-3 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-5">
            <Button type="submit" size="sm" variant="secondary">
              Apply filters
            </Button>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={!externalParkFilter || !internalParkFilter || isPending}
              onClick={saveParkMapping}
            >
              Save park link
            </Button>
            {selectedParkName && externalParkFilter ? (
              <p className="self-center text-xs text-royal/65">
                External park {externalParkFilter} will score against {selectedParkName}.
              </p>
            ) : null}
          </div>
        </form>
        {message ? <p className="mt-3 text-xs font-semibold text-royal">{message}</p> : null}
      </Card>

      {diagnostics.truncated ? (
        <p className="text-xs text-royal/60">
          Result set is truncated. Narrow the filters before mapping.
        </p>
      ) : null}

      {diagnostics.rows.length === 0 ? (
        <EmptyState
          title="No rows match these filters"
          description="Try another provider, park, or search term."
        />
      ) : (
        <div className="space-y-4">
          {diagnostics.rows.map((row) => {
            const best = row.suggestions[0];
            return (
              <Card
                key={`${row.provider}:${row.externalParkId}:${row.externalAttractionId}`}
                className="p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] text-royal/55">
                        {row.provider} · park {row.externalParkId} · ride{" "}
                        {row.externalAttractionId}
                      </p>
                      <span className="rounded-full border border-royal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-royal/65">
                        {row.category.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="mt-1 font-serif text-lg font-semibold text-royal">
                      {row.externalName ?? "Unnamed provider ride"}
                    </h3>
                    <p className="mt-1 text-xs text-royal/65">
                      {statusText(row)} · observed {shortDateTime(row.observedAt)}
                    </p>

                    {row.mappedAttractionId ? (
                      <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                        Mapped to {row.mappedAttractionName ?? row.mappedAttractionId}
                        {row.mappedParkName ? ` at ${row.mappedParkName}` : ""}.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-royal/70">
                          Suggested park:{" "}
                          <span className="font-semibold">
                            {row.suggestedParkName ?? "Choose a TripTiles park above"}
                          </span>
                        </p>
                        {row.suggestions.length === 0 ? (
                          <p className="text-xs text-royal/50">
                            No same-park attraction candidate. Check the park link or add
                            this mapping manually.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {row.suggestions.slice(0, 3).map((candidate) => (
                              <li
                                key={candidate.attractionId}
                                className="flex flex-col gap-2 rounded-lg border border-royal/10 bg-cream/40 p-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="text-xs text-royal">
                                  <span className="font-semibold">{candidate.name}</span>{" "}
                                  <span className="text-royal/55">
                                    {confidenceLabel(candidate.score)}
                                  </span>
                                </span>
                                <Button
                                  size="sm"
                                  variant={candidate === best ? "accent" : "secondary"}
                                  disabled={isPending}
                                  onClick={() =>
                                    saveRideMapping(row, candidate.attractionId)
                                  }
                                >
                                  Map
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <details className="rounded-lg border border-royal/10 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-royal">
                      Copy SQL
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-cream/60 p-3 font-mono text-[11px] leading-relaxed text-royal/80">
                      {buildRideSql(row)}
                    </pre>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
