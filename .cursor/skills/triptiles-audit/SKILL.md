---
name: triptiles-audit
description: Run a read-only TripTiles quality audit across the repo, tests, database evidence, deployments and local browser journeys. Use when the user asks for a TripTiles audit, launch check, or MCP verification.
---

# TripTiles audit

Read-only. Do not deploy, migrate, merge, edit Figma, or change production data.

## Steps

1. Record branch, commit and `git status`.
2. Read `AGENTS.md`, `CLAUDE.md` and `docs/COMMERCIAL_LAUNCH_READINESS.md`.
3. Run `npm test`, `npm run lint` and `npx tsc --noEmit`. Run a production build only when the audit needs bundle evidence.
4. Call each configured MCP server. Mark PASS only when a tool call returns data. Otherwise mark FAIL or REQUIRES USER ACTION and state the exact reason. Do not treat `mcp.json` as a connection.
5. Supabase, if connected: list tables, list migrations, and fetch security advisors for `inqexwdkuqdfdoaauxyw`. Compare with `supabase/migrations/`. Stop if history looks like the retired 12-version chain.
6. GitHub, if connected: list open pull requests and the latest quality-check runs. Do not merge.
7. Vercel, if connected: list recent deployments and failed builds. Do not redeploy. Do not print secret values.
8. Playwright, if connected: open the local app on port 3001 only. Check one public page and one signed-out protected redirect. Do not submit live forms or send email.
9. Figma, if connected: inspect the named frame the user provides. Do not modify the file.
10. Classify findings as confirmed failure, risk, or untested. End with a prioritised action list and the evidence for each item.

## Output

Use British English. Include commands, tool names and results. Omit tokens, keys and personal data.
