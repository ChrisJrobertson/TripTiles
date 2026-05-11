/**
 * Allowlisted safe backfills only. Default --dry-run.
 *
 * Operations (verify against DB before relying on counts):
 *  1) parks.country ← regions.country when park.country empty and cardinality(region_ids)=1
 *  2) region_skip_line_systems: insert ('none') for regions with has_disney/has_universal false
 *     and no existing mapping rows
 *  3) parks.icon ← default 🎢 when icon is null or whitespace-only (all built-in parks)
 *
 *   node --env-file=.env.local --import tsx scripts/safe-backfill-park-alignment.ts
 *   node --env-file=.env.local --import tsx scripts/safe-backfill-park-alignment.ts --apply
 */
import { createClient } from "@supabase/supabase-js";

/** Documented default when catalogue row has no icon (product convention). */
const DEFAULT_PARK_ICON = "🎢";

const PROTECTED_REGIONS = (process.env.ALIGNMENT_PROTECT_REGION_IDS ?? "orlando,cali")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, serviceKey);

  const summary: Record<string, number> = {
    parks_country_updates: 0,
    parks_icon_updates: 0,
    region_none_inserts: 0,
    skipped_protected_parks: 0,
  };

  const { data: parks, error: pe } = await sb
    .from("parks")
    .select("id, country, region_ids, is_custom, icon")
    .eq("is_custom", false);
  if (pe) {
    console.error(pe.message);
    process.exit(1);
  }

  const { data: regions, error: re } = await sb.from("regions").select("id, country");
  if (re) {
    console.error(re.message);
    process.exit(1);
  }
  const regionCountry = new Map((regions ?? []).map((r) => [r.id as string, r.country as string]));

  for (const p of parks ?? []) {
    const ids = (p.region_ids as string[]) ?? [];
    if (ids.length !== 1) continue;
    const rid = ids[0]!;
    if (PROTECTED_REGIONS.includes(rid)) {
      summary.skipped_protected_parks += 1;
      continue;
    }
    const ctry = (p.country as string | null)?.trim() ?? "";
    if (ctry.length > 0) continue;
    const rc = regionCountry.get(rid)?.trim() ?? "";
    if (!rc) continue;
    if (!apply) {
      summary.parks_country_updates = Number(summary.parks_country_updates) + 1;
      continue;
    }
    const { error } = await sb.from("parks").update({ country: rc }).eq("id", p.id as string);
    if (!error) summary.parks_country_updates = Number(summary.parks_country_updates) + 1;
    else console.error("update failed", p.id, error.message);
  }

  for (const p of parks ?? []) {
    if (p.is_custom) continue;
    const iconRaw = p.icon as string | null | undefined;
    const hasIcon = iconRaw != null && String(iconRaw).trim().length > 0;
    if (hasIcon) continue;
    if (!apply) {
      summary.parks_icon_updates = Number(summary.parks_icon_updates) + 1;
      continue;
    }
    const { error } = await sb
      .from("parks")
      .update({ icon: DEFAULT_PARK_ICON })
      .eq("id", p.id as string);
    if (!error) summary.parks_icon_updates = Number(summary.parks_icon_updates) + 1;
    else console.error("icon update failed", p.id, error.message);
  }

  const { data: regs, error: r2 } = await sb
    .from("regions")
    .select("id, has_disney, has_universal");
  if (r2) {
    console.error(r2.message);
    process.exit(1);
  }

  const { data: existing, error: r3 } = await sb.from("region_skip_line_systems").select("region_id");
  if (r3) {
    console.error(r3.message);
    process.exit(1);
  }
  const hasRow = new Set((existing ?? []).map((x) => x.region_id as string));

  for (const r of regs ?? []) {
    const rid = r.id as string;
    if (PROTECTED_REGIONS.includes(rid)) continue;
    if (r.has_disney || r.has_universal) continue;
    if (hasRow.has(rid)) continue;
    if (!apply) {
      summary.region_none_inserts = Number(summary.region_none_inserts) + 1;
      continue;
    }
    const { error } = await sb.from("region_skip_line_systems").insert({
      region_id: rid,
      skip_line_system_id: "none",
    });
    if (!error) {
      summary.region_none_inserts = Number(summary.region_none_inserts) + 1;
      hasRow.add(rid);
    } else if (error.code !== "23505") {
      console.error("insert none failed", rid, error.message);
    }
  }

  console.log(JSON.stringify({ dryRun: !apply, ...summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
