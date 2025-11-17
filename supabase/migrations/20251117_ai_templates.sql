-- AI Templates table for user-generated templates via AI
create table if not exists public.ai_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  canvas_json jsonb not null,
  preview_url text,
  created_at timestamptz not null default now()
);

alter table public.ai_templates enable row level security;

-- Policies: users can CRUD their own templates; anonymous cannot select/insert
create policy ai_templates_select_own on public.ai_templates
  for select
  using ( auth.uid() = user_id );

create policy ai_templates_insert_own on public.ai_templates
  for insert
  with check ( auth.uid() = user_id );

create policy ai_templates_update_own on public.ai_templates
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy ai_templates_delete_own on public.ai_templates
  for delete
  using ( auth.uid() = user_id );