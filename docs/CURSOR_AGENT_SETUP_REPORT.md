# Cursor agent setup report

Date: 14 October 2026. Branch started from `cursor/launch-readiness-027e` at `5ea0911`, which matched `origin/cursor/launch-readiness-027e` after `git fetch`. `origin/main` was still `a4b8130`. Working tree was clean before this change.

Repository: `https://github.com/ChrisJrobertson/TripTiles`.

## Initial state

- No `AGENTS.md`. `CLAUDE.md` held the migration rules.
- `.cursor/mcp.json` contained only Supabase, scoped to retired project `hjbbojypllltfjfuojzn`.
- No `.cursor/rules`, no project audit skill, no GitHub Actions workflows.
- Confirmed live Supabase reference in `.env.local.example` and `docs/COMMERCIAL_LAUNCH_READINESS.md`: `inqexwdkuqdfdoaauxyw`.
- Tests are npm `tsx` scripts. Playwright was not a project dependency.
- This cloud session already had a Supabase MCP namespace in the **needs authentication** state. No Supabase tool call was possible.

## Files added or modified

- `.cursor/mcp.json` — five official servers; Supabase moved to the confirmed project, read-only.
- `AGENTS.md`
- `.cursor/rules/architecture.mdc`
- `.cursor/rules/database-security.mdc`
- `.cursor/rules/ux-accessibility.mdc`
- `.cursor/rules/testing-quality.mdc`
- `.cursor/rules/release-operations.mdc`
- `.cursor/skills/triptiles-audit/SKILL.md`
- `.github/workflows/quality.yml`
- `docs/CURSOR_AGENT_SETUP.md`
- `docs/CURSOR_AGENT_SETUP_REPORT.md`
- `src/lib/auth/test-session-guard.test.ts` — type-only fix so `tsc` accepts the local runtime name. No behaviour change.

No application business logic, production data, Vercel settings or database migrations were changed. No secrets were written.

## Verification matrix

| Check | Result | Evidence |
| --- | --- | --- |
| Cursor project identification | PASS | Git remote `ChrisJrobertson/TripTiles`. Latest fetched product branch `cursor/launch-readiness-027e` at `5ea0911`. |
| `AGENTS.md` loading | NOT TESTED | File written this session. Suitability reviewed against the brief. A new Cursor chat is required to prove automatic loading. |
| Cursor project rules | NOT TESTED | Five `.mdc` files with descriptions and globs are in `.cursor/rules/`. This session did not show Cursor applying them. |
| Supabase MCP connection | REQUIRES USER ACTION | Unauthenticated GET returned 403. This session’s Supabase namespace status was `needsAuth`. No tool call succeeded. |
| Vercel MCP connection | REQUIRES USER ACTION | GET returned 401, `No authorization provided`. |
| GitHub MCP connection | REQUIRES USER ACTION | GET `https://api.githubcopilot.com/mcp/readonly` returned 401, `No access token was provided`. |
| Playwright MCP connection | REQUIRES USER ACTION | `npx -y @playwright/mcp@latest --version` printed `0.0.83` and `--help` succeeded. Cursor did not expose Playwright tools in this session, so the agent connection is not verified. |
| Figma MCP connection | REQUIRES USER ACTION | GET `https://mcp.figma.com/mcp` returned 405. No authenticated tool call. Plugin install needs the Cursor chat command `/add-plugin figma`. |
| Application tests | PASS | `npm run lint` exit 0 with the existing `MobileDayView.tsx` hook warning. `npx tsc --noEmit` exit 0. `npm test` exit 0. |
| CI/CD workflow | NOT TESTED | `.github/workflows/quality.yml` is new. It has not completed a GitHub Actions run yet. |
| Stored configuration security | PASS | `.cursor/mcp.json` has URLs and the Playwright command only. No tokens, headers or env secret values. `.gitignore` already ignores `.env*`. |

Configuration on disk is not counted as a connected server.

## Commands

```text
git fetch origin cursor/launch-readiness-027e main cursor/supabase-clean-baseline
python3 JSON parse of .cursor/mcp.json
GET the four remote MCP URLs without credentials
npx -y @playwright/mcp@latest --version
npm audit --omit=dev --audit-level=high
npm run lint
npx tsc --noEmit
npm test
```

`npm audit --omit=dev --audit-level=high` exited 1: 28 advisories (1 low, 18 moderate, 8 high, 1 critical). The critical item is Next.js in the current 15.5.x range. This setup did not upgrade dependencies. The audit job in CI uses `continue-on-error` so the finding stays visible without hiding it as a pass.

Production build was not repeated. Application code did not change. The previous production build on `5ea0911` succeeded.

## Issues

- MCP config pointed at the retired Supabase project.
- No CI workflow existed.
- `tsc` failed on the auth harness test until the runtime name was typed as `NodeJS.ProcessEnv["NODE_ENV"]`.
- Dependency audit reports a critical Next.js advisory and several high advisories. They are not fixed here.

## Manual steps

1. Cursor Settings → Tools & MCP: sign in to Supabase, Vercel and Figma.
2. Supabase organisation must be the one that contains `inqexwdkuqdfdoaauxyw`.
3. If GitHub does not offer OAuth, add a read-only personal access token in `~/.cursor/mcp.json` only.
4. Run `/add-plugin figma` if you want the official plugin skills as well as the URL entry.
5. Open a new chat so Cursor loads `AGENTS.md`.

## Remaining work

- Complete the five logins and repeat the audit skill so each server can move from REQUIRES USER ACTION to PASS or FAIL.
- Watch the first Quality workflow run on the pull request.
- Plan a Next.js security upgrade separately. Do not force it inside this setup.
- Catalogue docs still mention `hjbbojypllltfjfuojzn`. That is historical and was left unchanged.
