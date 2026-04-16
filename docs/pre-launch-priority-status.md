# Pre-launch priority status

_Last updated: reflects P1 + P2 verified closed; P4 reopened for production._

## Verified closed

- **Priority 1** — Profile tier, `handle_new_user`, migration sync, and profiles column parity (including `temperature_unit`, `email_marketing_opt_out`) are deployed and validated.
- **Priority 2** — Hydration fix validated on staging/production as applicable.

---

## Reopened — Priority 4 — QUICK PLACE (MOBILE) on desktop

**Status: reopened.** Previously closed as “not reproducible” via Tailwind breakpoint analysis (`MobilePlannerDock`: `hidden md:block lg:hidden`). **Production still shows the widget at desktop widths** (observed behaviour ≠ prior diagnosis). Possible causes: wrong component, duplicate label, breakpoint mismatch vs documented 1288px, or CSS order/specificity.

**Next session:** Re-investigate in the same batch as P3 / P5 / P6. Do not treat “not reproducible” as final when production still shows the issue.

---

## Queued — Priorities 3, 5, 6 (and P4 in same batch)

Use the **Next Cursor session prompt** below. Confirmed regressions still on the list:

- **Settings whitespace gap** → track under **Priority 6** (e.g. 6.7).
- **Mobile nav not collapsed** → **Priority 5**.

---

## Next Cursor session — paste prompt

```
P1 and P2 verified, both closed. Validation report attached. Reopening P4 — the QUICK PLACE (MOBILE) widget is still visible on desktop in production despite the previous closure. Investigate why the Tailwind breakpoint analysis didn't match observed behaviour.

Work through Priority 3, Priority 4 (reopened), Priority 5, and Priority 6 in one coherent pass where possible.

Priority 4: Find the element that renders "QUICK PLACE (MOBILE)" in production, trace responsive classes and parent layout, and fix so it does not appear at desktop widths. Compare breakpoints to MobilePlannerDock and any duplicate mobile-only widgets.

Priority 5: Address mobile nav collapse behaviour per the audit.

Priority 6: Include the Settings whitespace gap (6.7) and other remaining P6 items from the audit.

Confirmed regressions to fix in this batch: Settings whitespace (P6.x), mobile nav (P5).

Stripe / Payhip note (week 11, not a launch blocker now): Purchase history may show "No purchases recorded yet" while tier shows Pro; Payhip receipts are not proven to sync to the purchases table. When wiring Stripe webhooks for subscription receipts, build and E2E-test the receipt history path — do not assume the existing Settings UI works for the new payment system without verification.
```

---

## Diagnostic archive — Priority 1 (orphans)

Run `node scripts/count-orphan-auth-users.mjs` (or equivalent SQL) when touching auth/profiles. See `docs/migration-workflow.md` for migration discipline.

### `user_effective_tier` view

Removed by migration `20260414103000_drop_user_effective_tier.sql`. Ensure applied everywhere the app connects.
