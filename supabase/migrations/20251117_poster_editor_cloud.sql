-- Poster Editor Cloud schema for projects, assets, templates
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  canvas_json jsonb not null,
  preview_url text,
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects select own" on public.projects
  for select using ( auth.uid() = user_id );
create policy "projects insert own" on public.projects
  for insert with check ( auth.uid() = user_id );
create policy "projects update own" on public.projects
  for update using ( auth.uid() = user_id );
create policy "projects delete own" on public.projects
  for delete using ( auth.uid() = user_id );

-- Assets table (public and user-scoped)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  url text not null,
  thumb_url text,
  category text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

alter table public.assets enable row level security;
-- Allow read for everyone; writes only for authenticated
create policy "assets select all" on public.assets for select using ( true );
create policy "assets insert auth" on public.assets for insert with check ( auth.role() = 'authenticated' );
create policy "assets update own" on public.assets for update using ( auth.uid() = user_id );
create policy "assets delete own" on public.assets for delete using ( auth.uid() = user_id );

-- Templates table (public and user-scoped)
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preview_url text,
  canvas_json jsonb not null,
  category text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.templates enable row level security;
create policy "templates select all" on public.templates for select using ( true );
create policy "templates insert auth" on public.templates for insert with check ( auth.role() = 'authenticated' );
create policy "templates update own" on public.templates for update using ( auth.uid() = user_id );
create policy "templates delete own" on public.templates for delete using ( auth.uid() = user_id );