import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
/** Anon JWT; project may set publishable key instead (see .env.local.example). */
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function main(): Promise<void> {
  if (!url || !supabaseKey) {
    console.error(
      "❌ Missing NEXT_PUBLIC_SUPABASE_URL and a client key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local)",
    );
    process.exit(1);
  }

  const supabase = createClient(url, supabaseKey);

  const steps: { label: string; table: "parks" | "trips" | "profiles" }[] = [
    { label: "parks", table: "parks" },
    { label: "trips", table: "trips" },
    { label: "profiles", table: "profiles" },
  ];

  let failed = false;

  for (const { label, table } of steps) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(`❌ ${label}: ${error.message}`);
      failed = true;
    } else {
      console.log(`✅ ${label}: count = ${count ?? 0}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
