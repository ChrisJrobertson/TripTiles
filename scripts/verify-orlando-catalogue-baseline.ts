/**
 * Backwards-compatible entry: Orlando built-in park + attraction counts only.
 * For full Florida checksum (orlando, florida_combo, miami), use:
 *   npm run verify:florida-baseline
 */
import { createClient } from "@supabase/supabase-js";
import { runLegacyOrlandoSummary } from "./verify-florida-catalogue-baseline";

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
  await runLegacyOrlandoSummary(sb);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
