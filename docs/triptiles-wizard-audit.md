# TripTiles Wizard and Modal Audit

Date: 2026-05-06

## Scope

This audit covers trip creation, trip editing, onboarding, Smart Plan, day strategy, and planner action modals. It is a read-only design/logic audit for a future redesign pass. No behavior should be changed as part of this audit.

## Executive Summary

- `TripCreationWizard` is the main new-trip and onboarding wizard. It is also the primary place where broad trip planning preferences are collected.
- Existing trip edit/rename still uses the older `Wizard` component, not `TripCreationWizard`. This creates a duplicate trip details form and a different visual model for editing.
- `OnboardingWizard` is only a wrapper around `TripCreationWizard`; there is no separate onboarding form to merge.
- `SmartPlanModal` owns two different modes: high-level Smart Plan wizard flow and day-level touring-plan generation. It delegates the multi-step trip/day Smart Plan questions to `SmartPlanHolidayWizardSteps`.
- `DayPlannerModal` owns day-level AI adjustment, strategy generation, preview/save/undo, and embeds `PlanStrategyMiniWizard` when required day intent is missing.
- `SmartPlanHolidayWizardSteps` and `PlanStrategyMiniWizard` overlap conceptually on pace, rides/avoidances, meals, paid access, and park focus, but they serve different scopes. They should share visual primitives and option components, not be merged outright.
- Most modals duplicate the same overlay, panel, title, action footer, segmented control, tile button, progress/header, and error styles.

## Recommended Shared UI Components

These can be introduced or extended before redesigning individual flows:

- `ModalShell`: overlay, centered/bottom-sheet responsive panel, title, subtitle, close button, max-height scroll region.
- `WizardFrame`: modal/page wrapper with progress, heading, scroll body, sticky footer, loading/error state.
- `WizardProgress`: supports dots, step text, and optional section labels.
- `WizardFooterActions`: Back / Skip / Next / Primary / Cancel layout with disabled/loading conventions.
- `ChoiceCard`: selectable card used by trip type, Smart Plan scope/style/meal/paid options, path selection.
- `ChoicePill`: selectable pill used by pace, mobility, ride comfort, avoidances, park tokens.
- `SegmentedControl`: two-option or multi-option tabs used by Smart Plan mode, day planner mode, duplicate day tabs.
- `FieldGroup`: label, helper text, error text, and consistent input/select/textarea styling.
- `InlineAlert`: error, warning, upsell, and confirmation messages.

The new `Button`, `Card`, `Badge/Pill`, `SectionHeader`, `Surface/Panel`, `MetricPill`, and `EmptyState` primitives are safe to use in these flows, but they do not replace the need for modal/wizard-specific wrappers.

## Flow Inventory

### TripCreationWizard

1. File path: `src/components/planner/TripCreationWizard.tsx`
2. Purpose: New trip creation and first-run onboarding trip setup. Collects destination, dates, party, accessibility, theme, park priorities, queue-product preferences, and manual-vs-AI path.
3. Entry point: `PlannerClient` opens it when creating a new trip. `OnboardingWizard` renders it on `/onboarding`.
4. Required for core user flow: Yes. This is the primary new-trip creation flow.
5. Shared UI elements it uses: `InlineLoadingOverlay`, `LogoSpinner`, `TrippMascotImg`, `TrippSpeechBubble`, `TripThemePicker`, brand logo components. It does not yet use the new `Button/Card/Pill/SectionHeader` primitives.
6. Duplicated styling/components:
   - Local `ProgressDots`.
   - Repeated selectable card/button styles.
   - Repeated pill/checklist button styles.
   - Repeated footer button layout.
   - Repeated field label/input styling.
   - Repeated modal/page wrapper styling.
7. Redesign risk: High. It creates trips, stores planning preferences, sets the first plan path, and redirects/opens Smart Plan through query params.
8. Recommended changes:
   - Keep all state, validation, payload creation, and redirect behavior intact.
   - Move visual shell to `WizardFrame`.
   - Replace local `ProgressDots` with shared `WizardProgress`.
   - Replace step option tiles with `ChoiceCard` and `ChoicePill`.
   - Replace footer with `WizardFooterActions`.
   - Consider extracting step bodies into small presentational components only after tests/checks are in place.
9. What must not change:
   - `createTripAction` payload and tier-limit behavior.
   - `TripPlanningPreferences` mapping.
   - Plan path behavior (`manual` vs `ai`) and `openSmartPlan/autoGenerate` navigation.
   - Date validation, children/height parsing, queue-product gating by region.

### Legacy Edit Trip Wizard

1. File path: `src/components/planner/Wizard.tsx`
2. Purpose: Existing trip edit/rename flow for family name, adventure name, dates, destination, and cruise dates.
3. Entry point: `PlannerClient` renders it when `wizardOpen && wizardEditId`; the Edit trip, Rename, and TripSelector rename flows set this state.
4. Required for core user flow: Yes. It is the current edit-trip modal.
5. Shared UI elements it uses: `RegionPicker`.
6. Duplicated styling/components:
   - Separate overlay/panel/header/footer styles from `TripCreationWizard`.
   - Separate trip details/date/destination fields from new-trip setup.
   - Step text instead of shared progress.
   - Its own validation and defaults.
7. Redesign risk: Medium to High. It updates existing trips and can affect assignments/date ranges/cruise state.
8. Recommended changes:
   - Do not merge into `TripCreationWizard` immediately.
   - First wrap it in shared `ModalShell`, `WizardProgress`, and `WizardFooterActions`.
   - Later consider extracting a shared `TripDetailsFields` / `TripDatesRegionFields` used by both `Wizard` and `TripCreationWizard`.
   - Keep a separate edit mode unless the data-loss implications of changing dates/region are fully handled.
9. What must not change:
   - `updateTripFromWizardAction` payload.
   - Existing validation for max trip length and cruise date range.
   - Region/destination mapping through `legacyDestinationFromRegionId`.

### OnboardingWizard

1. File path: `src/components/onboarding/OnboardingWizard.tsx`
2. Purpose: First-trip onboarding wrapper.
3. Entry point: `/onboarding` route in `src/app/(app)/onboarding/page.tsx`.
4. Required for core user flow: Yes for first-time users, but it delegates the actual wizard to `TripCreationWizard`.
5. Shared UI elements it uses: `TripCreationWizard`.
6. Duplicated styling/components:
   - Only the skip button style is local.
   - No duplicate trip form.
7. Redesign risk: Low.
8. Recommended changes:
   - Use shared `Button` variant for the skip action.
   - Keep onboarding as a wrapper around `TripCreationWizard`.
9. What must not change:
   - `/onboarding` auth and no-existing-trips redirect behavior.
   - Skip behavior to `/planner`.

### SmartPlanModal

1. File path: `src/components/planner/SmartPlanModal.tsx`
2. Purpose: Smart Plan entry point for trip/day planning, custom prompt planning, and day-scope touring plan generation.
3. Entry point: `PlannerClient` opens it from Smart Plan action, empty calendar CTA, day detail “open Smart Plan”, and post-new-trip AI path query handling.
4. Required for core user flow: Yes. It is the main AI planning interface.
5. Shared UI elements it uses: `LogoSpinner`, `SequenceTimeline`, `SmartPlanHolidayWizardSteps`.
6. Duplicated styling/components:
   - Modal shell and footer actions.
   - Segmented controls for day planner source and mode.
   - Repeated option card/button styles.
   - Repeated warning/error/summary panel styles.
7. Redesign risk: High. It touches generation, cancellation, retry, free-tier messaging, saved planning preferences, and day touring sequence flow.
8. Recommended changes:
   - Preserve `onGenerate`, `onCancelGeneration`, `onRetryPartial`, `onTripPatch`, and touring generation behavior.
   - Replace visual shell with `ModalShell`.
   - Use `SegmentedControl`, `WizardFooterActions`, `InlineAlert`, and shared `Button`.
   - Keep `SmartPlanHolidayWizardSteps` as a child, but pass shared visual components or let it consume them directly.
9. What must not change:
   - `SmartPlanGeneratePayload` shape.
   - `holidayWizard` mapping through `smart-plan-holiday-wizard` helpers.
   - Day-scope behavior and touring-plan toggle behavior.
   - Cancel/retry semantics and free-tier cap display.

### SmartPlanHolidayWizardSteps

1. File path: `src/components/planner/SmartPlanHolidayWizardSteps.tsx`
2. Purpose: Step content for Smart Plan’s high-level holiday planning profile. Handles scope, trip style, party/pace, ride comfort/avoidances, meals/paid access, rest rhythm, park focus, and preview.
3. Entry point: Rendered inside `SmartPlanModal`.
4. Required for core user flow: Yes for guided Smart Plan mode.
5. Shared UI elements it uses: Local `TileButton`; no shared primitives yet.
6. Duplicated styling/components:
   - `TileButton` duplicates selectable card patterns in `TripCreationWizard`.
   - Pill button styles duplicate `PlanStrategyMiniWizard` and trip setup.
   - Step header/progress duplicates other wizard progress indicators.
7. Redesign risk: Medium. It does not directly persist, but its state is transformed into planning preferences and Smart Plan prompt supplements.
8. Recommended changes:
   - Replace `TileButton` with shared `ChoiceCard`.
   - Replace pills with shared `ChoicePill`.
   - Replace step header with `WizardProgress`.
   - Consider moving option metadata to shared constants only where semantics truly match.
9. What must not change:
   - Step order and `WIZARD_STEPS_TRIP` / `WIZARD_STEPS_DAY` behavior.
   - `HolidaySmartWizardState` values.
   - Preview semantics and mapping to `TripPlanningPreferences`.

### PlanStrategyMiniWizard

1. File path: `src/components/planner/PlanStrategyMiniWizard.tsx`
2. Purpose: Day-level planning intent wizard for AI Day Strategy. Captures day-specific park action, day type, ride level, avoidances, meals, pace, start/finish, paid access, mobility, heights, Disney/Universal queue preferences.
3. Entry point: Embedded inside `DayPlannerModal`; can also present as overlay via `presentation="overlay"`.
4. Required for core user flow: Yes for day strategy when required day planning intent is missing or incomplete.
5. Shared UI elements it uses: None of the new primitives directly.
6. Duplicated styling/components:
   - Question card/panel styles.
   - Choice pill/card styles.
   - Footer actions and timeout/error states.
   - Mobility/child-height/queue preference questions overlap with `TripCreationWizard`.
7. Redesign risk: High. It writes both trip-level planning preferences and day-level planning intent, then can trigger strategy generation.
8. Recommended changes:
   - Keep logic separate from `SmartPlanHolidayWizardSteps`; it is day-specific and has different persistence.
   - Adopt shared `ModalShell`/`WizardFrame` only around the UI.
   - Use `ChoiceCard`, `ChoicePill`, `FieldGroup`, `InlineAlert`, and `WizardFooterActions`.
   - Pre-fill and collapse already-known trip-level settings where possible to reduce repeated work.
9. What must not change:
   - `saveDayPlanningIntentAction` and `updateTripPlanningPreferencesAction` call order.
   - `onSaved` continuation path to strategy generation.
   - Timeout/watchdog behavior.
   - Required intent validation from `day-planning-intent`.

### DayPlannerModal

1. File path: `src/components/planner/DayPlannerModal.tsx`
2. Purpose: Day-level AI adjustment modal with “Suggest a day”, custom instructions, preview/save, undo, and Pro day strategy generation.
3. Entry point: `PlannerClient` opens it from day detail “Plan this day”, day strategy regeneration, and auto-run strategy paths.
4. Required for core user flow: Yes for day planning and day strategy.
5. Shared UI elements it uses: `LogoSpinner`, `PlanStrategyMiniWizard`.
6. Duplicated styling/components:
   - Modal shell.
   - Segmented control for adjustment modes.
   - Before/after cards.
   - Footer actions.
   - Upsell/warning/undo confirmation panels.
7. Redesign risk: High. It touches AI generation, preview persistence, undo snapshots, profile preference migration, and tier gating.
8. Recommended changes:
   - Keep generation and persistence logic intact.
   - Use `ModalShell`, `SegmentedControl`, `Card`, `InlineAlert`, and `WizardFooterActions`.
   - Treat `PlanStrategyMiniWizard` as a nested flow with a clear breadcrumb/back affordance.
9. What must not change:
   - `tweakDay`, `confirmTweakDay`, `popDaySnapshot`, and `generateDayStrategy` behavior.
   - Preview default migration from localStorage/profile preference.
   - Auto-run strategy behavior.
   - Tier-gate behavior for free users.

### DuplicateDayModal

1. File path: `src/components/planner/DuplicateDayModal.tsx`
2. Purpose: Duplicate one day to specific dates or recurring weekdays.
3. Entry point: Day detail duplicate action.
4. Required for core user flow: Useful but not essential for basic planning; important for power users and paid template-like flows.
5. Shared UI elements it uses: `BookingConflictModal` for replacement conflicts.
6. Duplicated styling/components:
   - Modal shell.
   - Segmented control.
   - Choice buttons for dates/weekdays.
   - Footer action pattern.
7. Redesign risk: Medium. It posts to an API route and has booking-anchor conflict handling and tier gating.
8. Recommended changes:
   - Use `ModalShell`, `SegmentedControl`, `ChoicePill`, and `WizardFooterActions`.
   - Keep conflict flow visually consistent with `BookingConflictModal`.
9. What must not change:
   - `/api/trip/[tripId]/day/[date]/duplicate` request shape.
   - Recurring weekday paid-tier gate.
   - Booking anchor checks before replace mode.

### CustomTileModal

1. File path: `src/components/planner/CustomTileModal.tsx`
2. Purpose: Create/edit custom planner tiles.
3. Entry point: Palette add custom and custom tile edit menu in planner side rail.
4. Required for core user flow: Important for custom planning but not mandatory for basic built-in park planning.
5. Shared UI elements it uses: none of the new primitives directly.
6. Duplicated styling/components:
   - Modal shell.
   - Field/input styles.
   - Swatch/emoji choice styles.
   - Footer actions and validation messages.
7. Redesign risk: Medium. It writes custom tiles and has tier-limit handling.
8. Recommended changes:
   - Use `ModalShell`, `FieldGroup`, `ChoicePill`, `Button`, and `InlineAlert`.
   - Keep colour swatches as a specialized presentational component.
9. What must not change:
   - `createCustomTileAction` and `updateCustomTileAction` payloads.
   - Free-tier custom tile cap behavior.
   - Login redirect on unauthenticated action failure.

### BookingConflictModal

1. File path: `src/components/planner/BookingConflictModal.tsx`
2. Purpose: Warn before clearing/changing slots or rides that have booking anchors.
3. Entry point: Planner slot assignment/clear, duplicate day replace, template apply replace, ride removal.
4. Required for core user flow: Yes for protecting paid/anchored bookings.
5. Shared UI elements it uses: local `AmberTriangle`.
6. Duplicated styling/components:
   - Modal shell and three-action footer.
   - Hard-coded colours separate from design tokens.
   - Warning alert style.
7. Redesign risk: Medium to High. It guards against destructive changes.
8. Recommended changes:
   - Use `ModalShell`, `InlineAlert`, and shared `Button` variants.
   - Keep primary action ordering carefully reviewed because this modal prevents accidental booking loss.
9. What must not change:
   - `BookingConflictAction` semantics.
   - The three outcomes: undo/keep booking, proceed keeping tracking, proceed clearing booking.
   - Focus-on-open and Escape dismissal behavior.

### DayTemplateDialogs

1. File path: `src/components/planner/DayTemplateDialogs.tsx`
2. Purpose: Save a day as a template and apply an existing template.
3. Entry point: Day detail More menu.
4. Required for core user flow: No for basic planning; important for Pro/Family productivity.
5. Shared UI elements it uses: `BookingConflictModal`.
6. Duplicated styling/components:
   - Two separate modal shells in one file.
   - Input/select/footer styles.
   - Template list option styles.
7. Redesign risk: Medium. It uses API routes and tier gating; apply can replace day content and trigger booking conflicts.
8. Recommended changes:
   - Use `ModalShell`, `FieldGroup`, `ChoiceCard`, `SegmentedControl`, and `WizardFooterActions`.
   - Consider splitting `SaveTemplateDialog` and `ApplyTemplateDialog` into separate files if redesign grows.
9. What must not change:
   - `/api/day-templates` and `/api/day-templates/[id]/apply` request/response behavior.
   - Free-tier lock behavior.
   - Booking anchor checks before replace mode.

### TierLimitModal

1. File path: `src/components/paywall/TierLimitModal.tsx`
2. Purpose: Generic paywall/limit modal for active trips, AI, and custom tile limits.
3. Entry point: `PlannerClient` opens it from trip cap, AI cap, and custom tile cap flows; other components can trigger it through callbacks.
4. Required for core user flow: Yes for correct product-limit UX.
5. Shared UI elements it uses: none of the new primitives directly.
6. Duplicated styling/components:
   - Modal shell.
   - CTA/cancel footer.
   - Button styles.
7. Redesign risk: Low to Medium. Mostly presentational, but pricing CTA must remain correct.
8. Recommended changes:
   - Use `ModalShell`, `Button`, and `InlineAlert` if needed.
   - Keep copy generated from variant/tier helpers.
9. What must not change:
   - Variant meanings: `trips`, `ai`, `custom`.
   - Pricing link and upgrade target tier formatting.

### DayStrategyUpgradeModal

1. File path: `src/components/planner/DayStrategyUpgradeModal.tsx`
2. Purpose: Specific Pro upsell for AI Day Strategy.
3. Entry point: `DayPlannerModal` and `PlannerClient` via `dayStrategyUpgradeOpen`.
4. Required for core user flow: Required for free-tier gating of day strategy, not for basic planning.
5. Shared UI elements it uses: none.
6. Duplicated styling/components:
   - Modal shell.
   - CTA/cancel footer.
   - Button styles.
7. Redesign risk: Low to Medium. It tracks analytics events.
8. Recommended changes:
   - Use `ModalShell` and `Button`.
   - Preserve `trackEvent` calls.
9. What must not change:
   - Analytics event names.
   - Pricing link behavior.

### UnsavedChangesModal

1. File path: `src/components/app/UnsavedChangesModal.tsx`
2. Purpose: Generic confirm-before-leaving modal.
3. Entry point: Used by flows with `useUnsavedChanges`, including day detail/template contexts.
4. Required for core user flow: Yes as a data-loss guard.
5. Shared UI elements it uses: none.
6. Duplicated styling/components:
   - Modal shell.
   - Three-action footer.
7. Redesign risk: Low, if behavior and button ordering remain unchanged.
8. Recommended changes:
   - Use `ModalShell`, `Button` variants, and `WizardFooterActions` or `ModalFooter`.
9. What must not change:
   - The three callbacks and their order/meaning.
   - Clear destructive styling for discard.

### PlannerClient Inline Confirmation Modals

1. File path: `src/app/(app)/planner/PlannerClient.tsx`
2. Purpose: Inline confirmations for undo Smart Plan, undo day tweak, and planner admin panel container.
3. Entry point: Smart Plan undo action, day tweak undo action, More menu admin panels.
4. Required for core user flow: Yes for undo/data-safety and sharing/family/day-notes management.
5. Shared UI elements it uses: Admin panel renders `ShareTripPanel`, `FamilyInvitePanel`, and `DayNotesPanel`.
6. Duplicated styling/components:
   - Inline modal shells embedded in the large planner file.
   - Repeated title/body/footer/button styles.
   - Admin panel shell repeats generic modal layout.
7. Redesign risk: Medium. These are tightly coupled to planner state and undo callbacks.
8. Recommended changes:
   - Extract `UndoSmartPlanConfirmModal`, `UndoDayTweakConfirmModal`, and `PlannerAdminPanelModal` as presentational wrappers.
   - Use `ModalShell`, `Button`, and shared alert components.
9. What must not change:
   - Undo snapshot checks and callbacks.
   - Admin panel content components and their persistence actions.

### ShareTripPanel and FamilyInvitePanel

1. File paths:
   - `src/components/planner/ShareTripPanel.tsx`
   - `src/components/planner/FamilyInvitePanel.tsx`
2. Purpose: Community sharing and family collaborator management inside planner admin modal.
3. Entry point: Planner More menu opens `adminPanel`.
4. Required for core user flow: Not required for basic planning; important for sharing/collaboration tiers.
5. Shared UI elements it uses: none.
6. Duplicated styling/components:
   - Panel/card styles.
   - Form field and button styles.
   - `FamilyInvitePanel` has its own nested invite modal.
7. Redesign risk:
   - `ShareTripPanel`: Medium, because it writes public sharing settings.
   - `FamilyInvitePanel`: Medium, because it manages collaborators and nested modal state.
8. Recommended changes:
   - Use shared `Card`, `Button`, `FieldGroup`, and `ModalShell`.
   - Consider making `FamilyInvitePanel` use the same modal shell for its nested invite dialog.
9. What must not change:
   - `updateTripSharingAction`, `updateTripPublicViewLabelsAction`, collaborator invite/revoke actions.
   - Tier gating for public sharing/family sharing.

## Specific Questions

### Are any wizard steps duplicating the same question or same input in different flows?

Yes, there is conceptual duplication:

- Party/accessibility:
  - `TripCreationWizard` asks adults, children, child ages, child heights, mobility.
  - `PlanStrategyMiniWizard` asks/derives mobility and child heights again for day strategy.
- Pace:
  - `TripCreationWizard` collects trip-level `PlanningPace`.
  - `SmartPlanHolidayWizardSteps` asks holiday pace.
  - `PlanStrategyMiniWizard` asks day-level pace.
- Ride comfort/avoidances:
  - `SmartPlanHolidayWizardSteps` asks ride level and avoidances.
  - `PlanStrategyMiniWizard` asks day-level ride level and avoidances.
  - `TripCreationWizard` asks priorities and must-do experiences, which partially overlap with ride/experience preferences.
- Meals:
  - `SmartPlanHolidayWizardSteps` asks how Smart Plan should handle meals.
  - `PlanStrategyMiniWizard` asks day-level meal preference.
- Paid queue access:
  - `TripCreationWizard` asks Disney Lightning Lane and Universal Express preferences.
  - `SmartPlanHolidayWizardSteps` asks whether Smart Plan should rely on paid queue access.
  - `PlanStrategyMiniWizard` asks day-level paid access and queue-product details.
- Park focus:
  - `TripCreationWizard` asks must-do parks.
  - `SmartPlanHolidayWizardSteps` asks must-do parks/focus areas.
  - `PlanStrategyMiniWizard` asks keep/change/add park for a specific day.

These should not all be merged, because trip-level, Smart Plan run-level, and day-level decisions have different scopes. The redesign should make scope explicit and avoid re-asking where a saved value can be displayed as “using your trip preference” with an edit affordance.

### Are there duplicate “trip details” forms between TripCreationWizard and edit trip?

Yes. `TripCreationWizard` collects destination, dates, cruise inclusion, and planning preferences for new trips. `Wizard` collects family/adventure names, dates, destination, and cruise details for edits. It is not a one-to-one duplicate because `TripCreationWizard` also collects preferences and path selection, but the base trip fields overlap.

Recommendation: Extract shared presentational field groups for name/date/region/cruise. Keep create and edit flows logically separate until date/region mutation side effects are fully reviewed.

### Are Smart Plan options duplicated between SmartPlanModal and PlanStrategyMiniWizard?

Partly. `SmartPlanModal` plus `SmartPlanHolidayWizardSteps` handles trip/day Smart Plan run options. `PlanStrategyMiniWizard` handles detailed day strategy intent. They overlap in pace, ride comfort/avoidance, meals, paid access, and park focus, but `PlanStrategyMiniWizard` is more operational and day-specific.

Recommendation: Share option UI components and possibly labels where semantics match. Do not merge state models or persistence paths.

### Are there repeated footer buttons/progress indicators that should become shared components?

Yes.

- `TripCreationWizard` has local `ProgressDots`.
- `Wizard` has `Step {n} of 4`.
- `SmartPlanHolidayWizardSteps` has its own step header.
- `SmartPlanModal`, `DayPlannerModal`, `DuplicateDayModal`, `CustomTileModal`, `DayTemplateDialogs`, `BookingConflictModal`, `TierLimitModal`, `DayStrategyUpgradeModal`, `UnsavedChangesModal`, and PlannerClient inline confirmations all duplicate modal footers and button hierarchies.

Recommendation: Add `WizardProgress`, `WizardFooterActions`, `ModalShell`, and `ModalFooter`.

### Are any wizard flows making the user do extra work unnecessarily?

Potentially yes:

- New users may provide party/accessibility/queue preferences in `TripCreationWizard`, then later see similar prompts in `SmartPlanHolidayWizardSteps` or `PlanStrategyMiniWizard`.
- Day strategy can require the mini wizard even when enough trip-level preferences exist; this may be necessary for day-specific intent but should be framed as “confirm this day” rather than “start again”.
- `SmartPlanHolidayWizardSteps` asks multiple high-level trip-shape questions even when a saved trip planning profile exists; hydration exists, but the UI could better show defaults and allow skipping to preview.
- Editing a trip uses a completely different legacy wizard, so users changing a trip do not see or understand the richer preferences they set during creation.

Recommendation: Add “Use saved trip preferences” summaries and edit/override controls in Smart Plan and Day Strategy rather than re-asking every field.

### Can any wizard use the new shared Button/Card/Pill/SectionHeader primitives without changing logic?

Yes.

Low-risk candidates:

- `OnboardingWizard` skip button.
- `TierLimitModal`.
- `DayStrategyUpgradeModal`.
- `UnsavedChangesModal`.
- `BookingConflictModal` buttons and alert shell.
- `DayTemplateDialogs`.
- `CustomTileModal`.

Medium-risk candidates:

- `Wizard` edit-trip visual shell.
- `DuplicateDayModal`.
- `SmartPlanHolidayWizardSteps` option cards/pills.

High-risk candidates where primitives are still safe but edits need careful testing:

- `TripCreationWizard`.
- `SmartPlanModal`.
- `PlanStrategyMiniWizard`.
- `DayPlannerModal`.

## Recommended Next Steps

1. Build modal/wizard infrastructure first:
   - `ModalShell`
   - `ModalFooter`
   - `WizardFrame`
   - `WizardProgress`
   - `WizardFooterActions`
   - `ChoiceCard`
   - `ChoicePill`
   - `SegmentedControl`
   - `FieldGroup`
   - `InlineAlert`

2. Convert low-risk modals first:
   - `TierLimitModal`
   - `DayStrategyUpgradeModal`
   - `UnsavedChangesModal`
   - `BookingConflictModal`

3. Convert utility planner modals next:
   - `CustomTileModal`
   - `DuplicateDayModal`
   - `DayTemplateDialogs`
   - PlannerClient inline undo/admin modals extracted to small components.

4. Convert `Wizard` edit-trip flow before touching `TripCreationWizard`.
   - This gives a safer place to prove shared trip details field components.

5. Redesign `TripCreationWizard`.
   - Keep all create/prefs/path logic unchanged.
   - Consider extracting step components after visual wrapper is stable.

6. Redesign Smart Plan flows last:
   - `SmartPlanModal`
   - `SmartPlanHolidayWizardSteps`
   - `DayPlannerModal`
   - `PlanStrategyMiniWizard`

7. After each conversion:
   - Run TypeScript, lint, and build.
   - Manually verify open/close, Back/Next, disabled states, tier gates, persistence actions, and generated payloads.

## Non-Negotiables for Redesign

- Do not change Supabase tables or persisted field names.
- Do not change server action/API route payloads.
- Do not change Smart Plan generation behavior.
- Do not change day strategy intent validation/persistence.
- Do not change tier gates or pricing links.
- Do not remove booking-conflict safeguards.
- Do not merge trip-level and day-level preference models unless a separate data migration/design decision is made.
