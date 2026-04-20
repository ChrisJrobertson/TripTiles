# Pre-launch priority status

_Last updated: P3–P6 fixes applied in repo; P4 closed as measurement artifact._

## Verified closed (code)

- **Priority 1** — Profile tier, `handle_new_user`, migrations, `temperature_unit`, `email_marketing_opt_out`.
- **Priority 2** — Hydration fix.
- **Priority 3** — Feedback FAB z-index vs planner toolbar: FAB is **`hidden md:flex`** so it only shows from the `md` breakpoint up (desktop/tablet landscape), not on narrow viewports where the bottom toolbar lives.
- **Priority 5** — App header: **`sm`** and up use the horizontal nav; below **`sm`**, a **Menu** `<details>` drawer lists all routes (planner tabs, passport, settings, pricing, feedback). Tier badge and upgrade stay **`sm:inline`** so mobile uses the drawer for navigation.
- **Priority 6.7** — Settings: single **`space-y-8`** on `<main>`; removed per-section **`mt-*`** gaps. SSO-only users get **`oauthProviderLabel`** copy instead of the password form or the magic-link blurb; email/password users unchanged.

## Priority 4 — Mobile planner dock (“Quick add”)

**Status: closed — false positive in audit / validation.** The dock uses `hidden md:block lg:hidden` (tablet-only). Reports at “1288px desktop” were consistent with a **CSS viewport ~909px** (e.g. Retina **1.42× browser zoom**), so Tailwind’s **`lg`** (1024 CSS px) had not kicked in — not a missing CSS fix.

**Follow-up for humans:** At **100% zoom** (`Cmd+0`), confirm `window.innerWidth` at your target width; record **CSS viewport**, not physical monitor pixels.

**UX:** Label updated from “Quick place (mobile)” to **“Quick add”** (tablet + mobile).

---

## Backlog (not regressions)

| Item | Notes |
|------|--------|
| **RSC 503 / failed prefetch** | Console: “Failed to fetch RSC payload” on `/settings?_rsc`, `/achievements?_rsc` — investigate before launch (CDN, deployment, or middleware). |
| **Stripe → billing history** | Confirm `purchases` rows update on renewals (`invoice.paid`) and failures (`invoice.payment_failed` email). Add monitoring if rows look stale. |

---

## Diagnostic archive — Priority 1 (orphans)

Run `node scripts/count-orphan-auth-users.mjs` when touching auth/profiles. See `docs/migration-workflow.md`.

### `user_effective_tier` view

Removed by `20260414103000_drop_user_effective_tier.sql`. Ensure applied on all environments.
