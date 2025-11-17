-- Realtime collaboration tables and policies

-- Add is_public to projects for public view access
alter table public.projects add column if not exists is_public boolean not null default false;

-- project_live_updates: per-object Fabric patch stream
create table if not exists public.project_live_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  op_type text not null check (op_type in ('add','modify','remove','transform','reorder','replace')),
  object_id text,
  payload jsonb not null,
  ts timestamptz not null default now()
);

alter table public.project_live_updates enable row level security;

-- comments: spatial comments attached to canvas coords
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  comment text not null,
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

alter table public.comments enable row level security;

-- RLS Policies
-- projects: allow select if owner (user_id) or is_public
drop policy if exists projects_select_policy on public.projects;
create policy projects_select_policy on public.projects
  for select
  using ( auth.uid() = user_id or is_public );

-- project_live_updates: insert/select by same user
drop policy if exists plu_select_policy on public.project_live_updates;
drop policy if exists plu_insert_policy on public.project_live_updates;
create policy plu_select_policy on public.project_live_updates
  for select
  using ( auth.uid() = user_id );

create policy plu_insert_policy on public.project_live_updates
  for insert
  with check ( auth.uid() = user_id );

-- comments: insert/select by same user; (optionally extend select later for shared projects)
drop policy if exists comments_select_policy on public.comments;
drop policy if exists comments_insert_policy on public.comments;
create policy comments_select_policy on public.comments
  for select
  using ( auth.uid() = user_id );

create policy comments_insert_policy on public.comments
  for insert
  with check ( auth.uid() = user_id );