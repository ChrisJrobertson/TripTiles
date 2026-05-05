# TripTiles Wizard V2 Specification

## Status

Canonical reference for the Day Planner / AI Day Strategy redesign.

This document consolidates the day planner wizard product decisions, implementation rules, and Cursor build prompts for the next iteration of TripTiles.

## Problem statement

The current AI Day Strategy can produce confident but over-assumed plans. Example failure modes include:

- Assuming the user wants rope drop.
- Assuming a thrill-heavy day.
- Assuming quick-service or table-service meals.
- Assuming paid queue access or Single Rider use.
- Assuming the family wants to stay until park close.
- Assuming re-rides are desirable.
- Assuming everyone in the group has the same ride tolerance.
- Generating a full open-to-close plan without explicit consent.

The product needs to capture explicit day-level intent before the AI generates a day strategy.

Core principle:

> The AI must never infer meals, rope drop, paid access, thrill level, late finish, or change permission. These must come from DayPlanningIntent or be explicitly marked as `suggest`.

## Current codebase anchors

Relevant files:

- `src/components/planner/DayPlannerModal.tsx`
- `src/components/planner/PlanStrategyMiniWizard.tsx`
- `src/actions/ai.ts`
- `src/lib/types.ts`
- `src/lib/day-strategy-planning.ts`
- `src/lib/planning-preferences-prompt.ts`
- `src/actions/profile-preferences.ts`
- `supabase/migrations/20260504130000_profiles_preferences_jsonb.sql`

Current strengths to preserve:

- Existing AI day planner modal.
- Existing Smart Plan and Full ride strategy separation.
- Existing preview-before-saving behaviour.
- Existing undo snapshots.
- Existing Pro / Family gating.
- Existing Smart Plan guardrails and closure-awareness rules.
- Existing Supabase JSONB preference patterns.

Do not rebuild the planner from scratch. Refactor the existing flow.

## Structural decisions

### Q1. Trip profile location

Decision: **Per-user in v1**.

New trips can inherit user-level defaults. Per-trip profile customisation can be deferred.

### Q2. Missing profile behaviour

Decision: **Wizard works with sensible defaults**.

Do not block the user with a forced profile setup modal. The day wizard should work even when no profile has been completed.

### Q3. Schema shape

Decision: **JSONB plus TypeScript validation**.

Planning preferences and day intent will evolve. JSONB avoids unnecessary migrations for every new option.

## Storage model

Use existing JSONB storage where possible.

Add a date-keyed day intent object under:

```ts
trips.preferences.ai_day_intent[date]
```

No SQL migration should be required if `trips.preferences` already exists as JSONB.

Important: saving day intent must use a safe server-side JSONB merge, not a client-side read-modify-write of the whole `preferences` object.

Preferred SQL pattern:

```sql
update trips
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  array['ai_day_intent', $date],
  $intent::jsonb,
  true
)
where id = $trip_id and owner_id = auth.uid();
```

This avoids overwriting unrelated keys such as `ai_day_timeline`, `ai_crowd_summary`, `day_notes`, or `must_dos` when multiple browser tabs are open.

## DayPlanningIntent type

Add the following to `src/lib/types.ts`.

```ts
export type DayPlanningParkAction =
  | "keep_existing"
  | "change_park"
  | "add_park"
  | "rest_day"
  | "suggest";

export type DayPlanningDayType =
  | "thrill_heavy"
  | "balanced_family"
  | "lower_thrill"
  | "shows_food_exploring"
  | "shorter_easier"
  | "suggest";

export type DayPlanningRideLevel =
  | "big_thrills"
  | "some_thrills"
  | "gentle"
  | "shows_lands_food";

export type DayPlanningMealPreference =
  | "do_not_plan"
  | "quick_service"
  | "table_service"
  | "mixed"
  | "snacks"
  | "existing_only"
  | "suggest";

export type DayPlanningPace =
  | "packed"
  | "balanced"
  | "relaxed"
  | "half_day";

export type DayPlanningStartPreference =
  | "rope_drop"
  | "normal_morning"
  | "slow_start"
  | "afternoon";

export type DayPlanningFinishPreference =
  | "after_lunch"
  | "mid_afternoon"
  | "early_evening"
  | "night_atmosphere"
  | "close";

export type DayPlanningPaidAccess =
  | "yes"
  | "no"
  | "not_sure"
  | "decide_later";

export type DayPlanningChangePermission =
  | "fill_gaps_only"
  | "add_around_existing"
  | "reorder_unlocked"
  | "replace_ai_only"
  | "start_again";

export type DayPlanningIntent = {
  parkAction: DayPlanningParkAction;
  selectedParkIds: string[];
  dayType: DayPlanningDayType;
  rideLevel: DayPlanningRideLevel;
  avoid: string[];
  mealPreference: DayPlanningMealPreference;
  pace: DayPlanningPace;
  startPreference: DayPlanningStartPreference;
  finishPreference: DayPlanningFinishPreference;
  paidAccess: DayPlanningPaidAccess;
  mustInclude: string;
  mustAvoid: string;
  changePermission: DayPlanningChangePermission;
  completedAt?: string;
};
```

Extend `TripPreferences` with:

```ts
ai_day_intent?: Record<string, DayPlanningIntent>;
```

## Helper module

Create:

```text
src/lib/day-planning-intent.ts
```

Exports:

- `readDayPlanningIntent(preferences, date)`
- `writeDayPlanningIntent(preferences, date, intent)`
- `getDefaultDayPlanningIntent(args)`
- `hasRequiredDayPlanningIntent(intent)`
- `formatDayPlanningIntentForPrompt(intent, context)`

### Defaulting rules

`getDefaultDayPlanningIntent` should use these rules:

- If the selected day already has a dominant theme park, default `parkAction` to `keep_existing` and `selectedParkIds` to that park ID.
- If no park exists, default `parkAction` to `suggest` and `selectedParkIds` to `[]`.
- Default `dayType` to `balanced_family`.
- Default `rideLevel` to `some_thrills`.
- Default `mealPreference` to `suggest`.
- Default `pace` to `balanced`.
- Default `startPreference` to `normal_morning`.
- Default `finishPreference` to `early_evening`.
- Default `paidAccess` to `not_sure`.
- Default `changePermission` to `add_around_existing`.
- Default `avoid` to `[]`.
- Default `mustInclude` and `mustAvoid` to empty strings.

### Required fields

`hasRequiredDayPlanningIntent` should require:

- `parkAction`
- `dayType`
- `rideLevel`
- `mealPreference`
- `pace`
- `startPreference`
- `finishPreference`
- `paidAccess`
- `changePermission`

`selectedParkIds` is required only when `parkAction` is:

- `keep_existing`
- `change_park`
- `add_park`

It is not required for:

- `rest_day`
- `suggest`

## Wizard questions

The day wizard should capture the following.

### 1. What should this day be built around?

Options:

- Keep existing park
- Change park
- Add another park
- Rest / pool day
- Let TripTiles suggest

### 2. What kind of day do you want?

Options:

- Thrill-heavy day
- Balanced family day
- Lower-thrill day
- Shows, food and exploring
- Shorter / easier day
- Let TripTiles suggest

### 3. What ride level should TripTiles plan for?

Options:

- Big coasters and thrill rides are fine
- Some thrill rides, mixed with gentler rides
- Gentle / lower-intensity rides only
- Mostly shows, lands, food and atmosphere

### 4. Anything to avoid?

Multi-select chips:

- Big drops
- Inversions
- Spinning
- Motion simulators
- Scary rides
- Water rides
- Long standing queues

### 5. How should meals work today?

Options:

- Do not plan meals
- Quick-service only
- Table-service only
- Mix of quick-service and table-service
- Snacks / light food only
- Use existing reservations only
- Let TripTiles suggest

If `mealPreference` is `existing_only`, the AI prompt must explicitly list the existing lunch/dinner slots and state that the model must not add any further meal stops.

### 6. What pace do you want?

Options:

- Packed day
- Balanced day
- Relaxed day
- Half-day / lighter day

### 7. How should the day start and finish?

Start options:

- Rope drop
- Normal morning start
- Slow start
- Afternoon start

Finish options:

- Leave after lunch
- Leave mid-afternoon
- Early evening
- Stay for night atmosphere
- Stay until close

### 8. Are you using paid queue access?

Options:

- Yes
- No
- Not sure
- Decide later

If `paidAccess` is `no` or `not_sure`, the prompt must say not to assume Express, Lightning Lane, Premier Pass, Single Rider, or similar paid queue tactics.

### 9. Anything TripTiles must include or avoid?

Two text areas:

- Must include today
- Must avoid today

### 10. How much can TripTiles change?

Options:

- Fill empty gaps only
- Add suggestions around what is already there
- Reorder unlocked items
- Replace AI-generated items only
- Start again for this day

## Additional planning details

Keep the existing fields, but place them after the core day intent questions or under an “Additional planning details” section:

- Mobility
- Child heights
- Disney Lightning Lane / Multi Pass questions
- Universal Express / Single Rider questions

## Prompt hierarchy

`formatDayPlanningIntentForPrompt` must return a plain text block similar to:

```text
DAY PLANNING INTENT — HARD RULES:
- Selected date: {date}
- Existing park: {existingParkName or none}
- Park action: {parkAction}
- Selected parks: {park names or none}
- Day type: {human readable}
- Ride level: {human readable}
- Avoid: {avoid list or none}
- Meals: {human readable meal preference}
- Existing meals: {existing lunch/dinner slots or none}
- Pace: {human readable}
- Start: {human readable}
- Finish: {human readable}
- Paid access: {human readable}
- Must include: {mustInclude or none}
- Must avoid: {mustAvoid or none}
- Change permission: {human readable}

PRIORITY ORDER:
1. Change permissions beat everything.
2. Day intent beats trip defaults.
3. Trip defaults beat generic theme park assumptions.
4. Generic assumptions are only allowed when the user selected "suggest".

HARD AI RULES:
- Do not assume quick-service meals unless selected.
- Do not assume table-service meals unless selected.
- If meals are existing-only, use only the existing meal slots and do not add more.
- Do not assume paid queue access unless selected as yes.
- Do not assume rope drop unless selected.
- Do not assume a thrill-heavy day unless selected.
- Do not recommend avoided ride types.
- Do not create an open-to-close plan unless finishPreference is close.
- Do not overwrite existing user-created tiles unless changePermission allows it.
```

## DayPlannerModal changes

Update labels:

- `Adjust parks & slots` → `Quick plan`
- `Full ride strategy` → `Build day strategy`
- `Smart suggest` → `Suggest a day`
- `Tell the AI` → `Custom instructions`
- `Generate ride strategy` → `Preview day strategy`

Behaviour:

- When the user clicks Build day strategy, check whether a complete `DayPlanningIntent` exists for the selected date.
- If missing or incomplete, open `PlanStrategyMiniWizard` first.
- After saving, continue the existing `generateDayStrategy` flow.
- Keep preview-before-saving.
- Keep undo.
- Keep Pro / Family gating.

## AI action changes

In `generateDayStrategy` inside `src/actions/ai.ts`:

- Read `trip.preferences.ai_day_intent[date]`.
- If missing or incomplete, return existing `missing_data` status.
- Build existing day context:
  - date
  - existing park id/name
  - current AM/PM/lunch/dinner assignments
  - existing lunch/dinner slots if present
  - existing must-dos if present
  - existing `ai_day_strategy` if present
- Insert the day-intent prompt block near the top of the prompt sent to Anthropic.
- Preserve all existing guardrails, closure awareness, JSON-only response rules, and validation.

## Missing-data validation

Update `src/lib/day-strategy-planning.ts` so missing-data detection includes day intent as well as the current fields.

Required day intent missing fields:

- `dayIntent`
- `parkAction`
- `dayType`
- `rideLevel`
- `mealPreference`
- `pace`
- `startPreference`
- `finishPreference`
- `paidAccess`
- `changePermission`

Keep existing checks for:

- child heights
- mobility
- Disney Lightning Lane details
- Universal Express details

## Cursor implementation sessions

### Session 1 — Types, helpers and safe persistence

Scope:

- Add `DayPlanningIntent` types.
- Extend `TripPreferences`.
- Create `src/lib/day-planning-intent.ts`.
- Add a safe server action that stores `trips.preferences.ai_day_intent[date]` using database-level JSONB merge.
- Do not change UI yet.
- Do not change AI prompt yet.

Acceptance criteria:

1. TypeScript compiles.
2. No unrelated files are changed.
3. Saving day intent does not overwrite unrelated `trips.preferences` keys.
4. No new SQL migration unless absolutely required.

### Session 2 — Day intent wizard and modal copy

Scope:

- Refactor `PlanStrategyMiniWizard` into the day intent wizard.
- Keep existing additional planning questions.
- Wire `DayPlannerModal` so Build day strategy opens the wizard when intent is missing.
- Apply label copy changes.
- Keep current preview, undo, tier gating and route refresh behaviour.

Acceptance criteria:

1. Build day strategy opens the wizard first when no day intent exists.
2. Completing the wizard saves intent and continues generation.
3. Existing Pro / Family gating still works.
4. Existing preview and undo still work.
5. UI remains mobile-friendly.

### Session 3 — AI prompt enforcement and missing-data validation

Scope:

- Update `generateDayStrategy` to read and require day intent.
- Insert `formatDayPlanningIntentForPrompt` into the AI prompt.
- Update missing-data validation.
- Preserve all existing Smart Plan and closure guardrails.

Acceptance criteria:

1. AI prompt contains the day-intent hard rules.
2. If `paidAccess` is `no` or `not_sure`, paid access is explicitly forbidden in the prompt.
3. If `mealPreference` is `do_not_plan`, meals are explicitly forbidden unless already present.
4. If `mealPreference` is `existing_only`, existing meal slots are listed and no additional meals are allowed.
5. If `startPreference` is not `rope_drop`, the prompt forbids assuming rope drop.
6. If `finishPreference` is not `close`, the prompt forbids creating a park-close plan.
7. Existing guardrails remain intact.

### Session 4 — Scope C follow-up

Scope to confirm separately:

- Multi-park handling.
- Per-tier behaviour.
- Regenerate-existing-trips CTA.

Do this only after Sessions 1–3 are stable.

## Do not do

- Do not rebuild the planner from scratch.
- Do not remove existing guardrails.
- Do not remove closure-awareness rules.
- Do not change Stripe, auth or unrelated subscription behaviour.
- Do not change Smart Plan full-trip behaviour unless required for compilation.
- Do not add unnecessary SQL migrations.
- Do not perform client-side whole-object writes to `trips.preferences` for day intent.
