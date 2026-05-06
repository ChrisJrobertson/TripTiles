# TripTiles synopsis (main)

This document summarises the shipped set of marketing, settings, Passport, and plumbing changes in this push.

## Marketing

- **Landing** (`/`): trust strip (non-numeric reassurance), hero emphasis and slight card tilt, secondary CTA points to **pricing**, single pull-quote instead of a star grid, **five** FAQ items in expandable `<details>` rows, community cards no longer show clone/view counts (copy-only “Public itinerary”), richer final CTA with sparkle wash and **See pricing** alongside signup.
- **Pricing** (`/pricing`): shared **MarketingTrustStrip** under the headline.
- **Feedback** (`/feedback`): category dropdown prefixes the mailto subject (`[Bug]`, `[UX]`, `[Idea]`, `[Billing]`, `[Feedback]`).
- **Footer**: planner-style tagline plus **Planner v** label aligned with the in-app planner shell (`src/lib/planner-version.ts`), shared with `PlannerClient`.

## Settings

- **`/settings`** redirects to **`/settings/profile`**.
- **Layout** wraps all settings routes with **AppNavHeader** plus a **sidebar** (desktop links, mobile `<select>`).
- **Sections**: Profile (name + security/password/sign-out), Notifications (temperature unit only), Subscription (plan, Stripe portal, billing history, templates upsell for paid users), Data & privacy (export JSON, email marketing opt-out, danger zone).
- **Day templates** (`/settings/templates`) sits under the same layout; back link goes to subscription; free users still redirect to pricing.
- **Account panel** was split into focused client cards; server actions revalidate **`/settings` layout** after profile/account changes.

## Passport

- New authenticated **`/passport`**: trips sorted by start date, derived status (past / upcoming / in progress), **clones earned** (sum of `clone_count`), distinct **parks from assignments**, “unreliable” profile stats rendered as **—** with explanatory hints, stamp-style park list, six most recent achievements and link to **`/achievements`**.
- **Nav**: “Passport” goes to **`/passport`**; tab highlights on `/passport` or `/achievements`. “Settings” goes to **`/settings/profile`** (including planner mobile menu).
- **Middleware** and **`robots.txt`** allow/disallow **`/passport`** appropriately.

## Data / libs

- **`getParksByIds`** in `src/lib/db/parks.ts` for passport stamps.
- **`src/lib/passport-helpers.ts`** for park ID collection and trip status helpers.

## Reference

- Visual/copy reference remains **`redesign.html`** at repo root (not wired into the Next app).
