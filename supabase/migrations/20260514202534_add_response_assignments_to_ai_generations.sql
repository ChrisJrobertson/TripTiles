-- Applied on production as 20260514202534 via Supabase MCP.
-- Stores post-guardrail Smart Plan assignments for observability.

alter table public.ai_generations
  add column if not exists response_assignments jsonb;

comment on column public.ai_generations.response_assignments is
  'Post-guardrail parsed day assignments from Smart Plan (diagnostic).';

notify pgrst, 'reload schema';
