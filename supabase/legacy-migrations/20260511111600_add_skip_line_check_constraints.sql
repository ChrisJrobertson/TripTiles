-- Phase 5: Lock the canonical vocabulary behind CHECK constraints.
-- Pre-flight verified zero rows would violate; safe to apply.

alter table attractions
  add constraint chk_attractions_skip_line_system
    check (
      skip_line_system is null
      or skip_line_system in ('lightning_lane', 'premier_access', 'express', 'none')
    );

alter table attractions
  add constraint chk_attractions_skip_line_tier
    check (
      skip_line_tier is null
      or skip_line_tier in (
        'single_pass',
        'multi_pass_tier1',
        'multi_pass_tier2',
        'multi_pass',
        'express'
      )
    );

alter table region_skip_line_systems
  add constraint chk_region_skip_line_system_id
    check (
      skip_line_system_id in ('lightning_lane', 'premier_access', 'express', 'none')
    );

alter table parks
  add constraint chk_parks_enrichment_status
    check (
      enrichment_status is null
      or enrichment_status in (
        'verified',
        'template',
        'no_fixed_hours',
        'seasonal',
        'unverified'
      )
    );
