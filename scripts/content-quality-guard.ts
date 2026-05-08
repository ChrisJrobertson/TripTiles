/**
 * Static guard for copy that must not ship in customer-facing bundles.
 * Run: node --import tsx scripts/content-quality-guard.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/** Keep narrow — library files may mention tokens in comments or filters. */
const BANNED_SUBSTRINGS: { needle: string; hint: string }[] = [
  { needle: "[YOUR UK REGISTERED ADDRESS]", hint: "legal placeholder" },
];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p);
  }
}

function main() {
  const files: string[] = [];
  walk(SRC, files);
  let failures = 0;
  for (const file of files) {
    if (file.includes(join("src", "lib", "email", "templates"))) continue;
    const text = readFileSync(file, "utf8");
    for (const { needle, hint } of BANNED_SUBSTRINGS) {
      if (text.includes(needle)) {
        console.error(`FAIL ${file}: contains banned substring (${hint}): ${needle}`);
        failures += 1;
      }
    }
  }
  if (failures > 0) {
    process.exit(1);
  }
  console.log("content-quality-guard: PASS");
}

main();
