
-- ============================================================================
-- Session 10 prep: in-app feedback table
-- 
-- Lets users submit feedback from a widget without email back-and-forth.
-- Useful for: bug reports, feature requests, general comments.
-- You (the owner) read the feedback in the Supabase dashboard or via a
-- simple /admin/feedback page (can add later).
-- ============================================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  anonymous_email text,
  category text not null,
  message text not null,
  page_url text,
  user_agent text,
  resolved boolean default false,
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  
  constraint feedback_category_check check (
    category in ('bug', 'feature', 'question', 'compliment', 'other')
  ),
  constraint feedback_message_length check (
    char_length(message) between 5 and 5000
  )
);

alter table feedback enable row level security;

-- Users can submit their own feedback
create policy "Feedback insert own or anonymous"
  on feedback for insert
  with check (
    user_id = (select auth.uid())
    or (user_id is null and anonymous_email is not null)
  );

-- Users can see their own feedback history (not others)
create policy "Feedback select own"
  on feedback for select
  using (user_id = (select auth.uid()));

-- Indexes for the admin viewer
create index feedback_created_at_idx on feedback(created_at desc);
create index feedback_resolved_idx on feedback(resolved) where resolved = false;
create index feedback_category_idx on feedback(category);

comment on table feedback is 
  'In-app user feedback. Read by admin via dashboard or admin page.';
;
