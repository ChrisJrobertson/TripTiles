alter table public.ai_generations
  drop constraint if exists ai_generations_status_check;

alter table public.ai_generations
  add constraint ai_generations_status_check
  check (status in ('pending', 'success', 'failed', 'cancelled'));

comment on column public.ai_generations.status is
  'Lifecycle state: pending (reserved pre-Claude-call), success (Claude succeeded), failed (Claude failed), cancelled (user aborted). The rate limit counts pending + success rows.';
