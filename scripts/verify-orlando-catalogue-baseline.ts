/**
 * Prints row counts for Orlando-linked built-in parks and their attractions.
 * Re-run after imports; counts should match unless you used --allow-protected.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-orlando-catalogue-baseline.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL / anon key");
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: oParks, error: e1 } = await sb
    .from("parks")
    .select("id")
    .eq("is_custom", false)
    .contains("region_ids", ["orlando"]);
  if (e1) {
    console.error(e1.message);
    process.exit(1);
  }
  const ids = (oParks ?? []).map((p) => p.id as string);
  let att = 0;
  if (ids.length > 0) {
    const { count, error: e2 } = await sb
      .from("attractions")
      .select("*", { count: "exact", head: true })
      .in("park_id", ids);
    if (e2) {
      console.error(e2.message);
      process.exit(1);
    }
    att = count ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        orlando_built_in_parks: ids.length,
        orlando_attractions: att,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
