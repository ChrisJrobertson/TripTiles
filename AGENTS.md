# TripTiles agent instructions

TripTiles is a Next.js 15 App Router application (React 19, TypeScript, Tailwind 4) with Supabase, Stripe, Anthropic, Resend, Sentry and Vercel. Package manager: npm. Dev server: `npm run dev` (port 3001). Tests are `tsx` assertion scripts via `npm test`, not Jest.

The confirmed Supabase project is `inqexwdkuqdfdoaauxyw`. Do not treat `hjbbojypllltfjfuojzn` or `kdmxevvmmsszqkwbmiko` as the live project. Migration rules in `CLAUDE.md` still apply.

## How to work

1. Read the existing implementation before editing it.
2. Prefer the smallest change that solves the task.
3. Reuse current components, server actions and libraries.
4. Do not invent API contracts, tables, product requirements or finished behaviour.
5. Separate facts, assumptions and unverified findings.
6. Follow the architecture already in the repository.
7. Cover loading, empty, error, permission-denied and network-failure states when changing a user journey.
8. Keep secrets, service-role keys and personal data out of commits, logs and docs.
9. Run the relevant checks after a code change: `npm test`, `npm run lint`, and `npx tsc --noEmit` when types change. Run `NODE_ENV=production npm run build` when routing, server code or the production bundle could be affected.
10. Report files changed, commands run, results and remaining risk.
11. Do not call a feature complete because the code exists. Do not call the product launch-ready without evidence in `docs/COMMERCIAL_LAUNCH_READINESS.md`.

## Safe to do without asking

Ordinary application code, tests, documentation, read-only inspection, local builds and local browser checks against the dev server.

## Ask before proceeding

- Applying or resetting database migrations, deleting or rewriting production data, or forcing migration history.
- Production deploys, live Stripe charges, or changes to cloud security and branch protection.
- Merging, deleting branches, or changing repository settings.
- Editing Figma files.
- Printing or committing secrets.

Read-only Supabase MCP is configured for `inqexwdkuqdfdoaauxyw`. A configured server is not connected until a tool call succeeds. Setup and troubleshooting: `docs/CURSOR_AGENT_SETUP.md`. Full audit: follow `.cursor/skills/triptiles-audit/SKILL.md`.
