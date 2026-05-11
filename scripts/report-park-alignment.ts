/**
 * Read-only alignment report from views `region_alignment_rollup` and
 * `park_alignment_completeness`.
 *
 *   node --env-file=.env.local --import tsx scripts/report-park-alignment.ts
 *   node --env-file=.env.local --import tsx scripts/report-park-alignment.ts --region-id paris
 */
import { createClient } from "@supabase/supabase-js";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL and anon/publishable key");
    process.exit(1);
  }
  const regionFilter = process.argv.includes("--region-id")
    ? process.argv[process.argv.indexOf("--region-id") + 1]?.trim() || null
    : null;

  const supabase = createClient(url, key);

  const { data: rollup, error: e1 } = await supabase
    .from("region_alignment_rollup")
    .select("*")
    .order("region_id");
  if (e1) {
    console.error("region_alignment_rollup:", e1.message);
    console.error(
      "(If this fails, apply migration 20260509120000_park_alignment_infrastructure.sql to your Supabase project.)",
    );
    process.exit(1);
  }

  let rows = rollup ?? [];
  if (regionFilter) {
    rows = rows.filter((r: { region_id: string }) => r.region_id === regionFilter);
  }

  console.log("# Park alignment — region rollup\n");
  for (const r of rows) {
    console.log(`## ${r.region_id} — ${r.region_name ?? ""}`);
    console.log(`- data_quality_tier: ${r.data_quality_tier ?? ""}`);
    console.log(`- parks (rows): ${r.park_rows}`);
    console.log(`- complete: ${r.parks_complete} | blocked: ${r.parks_blocked}`);
    console.log(`- avg score: ${r.avg_completeness_score}`);
    console.log(
      `- gaps: missing attractions ${r.parks_missing_attractions}, url ${r.parks_missing_url}, hours ${r.parks_missing_hours}, coords ${r.parks_missing_coordinates}, areas ${r.parks_missing_areas}, region briefing ${r.region_without_briefing}, park briefing ${r.parks_missing_park_briefing}`,
    );
    console.log(`- CSV templates: see /templates/README.md\n`);
  }

  const { data: parksRaw, error: e2 } = await supabase
    .from("park_alignment_completeness")
    .select("region_id, park_id, park_name, completeness_score, readiness, next_action_hint")
    .order("completeness_score", { ascending: true })
    .limit(800);

  if (e2) {
    console.error("park_alignment_completeness:", e2.message);
    process.exit(1);
  }

  const parkSample = (parksRaw ?? [])
    .filter((p: { region_id: string }) => !regionFilter || p.region_id === regionFilter)
    .slice(0, regionFilter ? 80 : 40);

  console.log("## Lowest-scoring parks (sample)\n");
  for (const p of parkSample) {
    console.log(
      `- **${p.park_id}** (${p.park_name}) @ ${p.region_id} — ${p.completeness_score} [${p.readiness}] — ${p.next_action_hint}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
