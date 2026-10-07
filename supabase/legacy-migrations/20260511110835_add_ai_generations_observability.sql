-- Observability fields for ai_generations (already applied on linked production before this file was added to the repo).
-- Idempotent so fresh environments converge safely.

alter table public.ai_generations
  add column if not exists response_completion_status text,
  add column if not exists prompt_data_quality_summary jsonb,
  add column if not exists output_park_region_match boolean;
