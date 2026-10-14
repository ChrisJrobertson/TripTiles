# Cursor agent setup

TripTiles agent configuration for Cursor. Credentials stay in your Cursor account login, not in this repository.

## What is configured

Project file `.cursor/mcp.json` declares five official servers:

| Server | Endpoint | Access in this repo |
| --- | --- | --- |
| Supabase | `https://mcp.supabase.com/mcp` | Project `inqexwdkuqdfdoaauxyw`, `read_only=true`, features `database`, `docs`, `debugging` |
| Vercel | `https://mcp.vercel.com` | Official hosted server. No token in git. |
| GitHub | `https://api.githubcopilot.com/mcp/readonly` | Read-only toolset. No personal access token in git. |
| Playwright | `npx -y @playwright/mcp@latest` | Local stdio server. Verified package version 0.0.83. |
| Figma | `https://mcp.figma.com/mcp` | Official remote server. No token in git. |

`AGENTS.md` is the durable project instruction file. Scoped rules are in `.cursor/rules/`. The reusable audit is `.cursor/skills/triptiles-audit/SKILL.md`.

Quality checks for pull requests are in `.github/workflows/quality.yml`. That workflow does not deploy and does not run migrations.

## Authentication

Cursor prompts for OAuth when a remote server is first used.

1. Open **Cursor Settings → Tools & MCP**.
2. Enable Supabase, Vercel, GitHub and Figma.
3. Sign in when Cursor asks. For Supabase, choose the organisation that owns `inqexwdkuqdfdoaauxyw`.
4. For Figma, the preferred install is the official plugin: in Cursor chat run `/add-plugin figma`, then sign in. If that adds a second Figma server, keep one entry so tools are not duplicated.
5. GitHub’s hosted server may ask for a personal access token instead of OAuth. Put that token only in your user-level `~/.cursor/mcp.json` (or a `${env:NAME}` header there). Do not commit it. Use a token that can read this repository, pull requests and Actions, and no admin rights.
6. Playwright needs no token. The first tool call may download a browser. Use `http://localhost:3001` and the `--isolated` behaviour of the server. Do not point it at production customer flows.

A server listed in `mcp.json` is not connected until one of its tools returns data.

## Using the agent

Normal coding, tests and documentation do not need extra approval. Ask before a database migration, production deploy, live charge, branch-protection change, or Figma edit.

Start the app with `npm run dev` (port 3001).

## Running an audit

In a new Cursor chat, ask:

```text
Use the triptiles-audit skill. Run a read-only TripTiles audit and mark each MCP server PASS only after a successful tool call.
```

The skill reads the repo, runs `npm test`, `npm run lint` and `npx tsc --noEmit`, then queries whichever MCP servers are actually connected.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Supabase tools missing or 401/403 | Sign in again under Tools & MCP. Confirm the org contains `inqexwdkuqdfdoaauxyw`. The old ref `hjbbojypllltfjfuojzn` is not the live project. |
| Supabase offers write tools | The project URL must still include `read_only=true`. Do not remove it. |
| Vercel returns 401 | Complete the Vercel login. Do not paste a token into the repo. |
| GitHub returns 401 | Add a read-only token in user-level MCP config, not in `.cursor/mcp.json`. |
| Figma returns 405 or will not connect | Install `/add-plugin figma` and finish the browser consent. |
| Playwright command fails | Run `npx -y @playwright/mcp@latest --version` locally. Node and network access are required. |
| Quality workflow dependency audit is red or amber | `npm audit` currently reports existing advisories, including Next.js. The audit job is allowed to fail so it stays visible without blocking the build. Do not treat that as a clean bill of health. |
