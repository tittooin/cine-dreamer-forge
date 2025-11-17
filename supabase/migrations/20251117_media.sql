-- Media assets and clips tables for poster editor media timeline
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  url text not null,
  duration numeric,
  mime text,
  width integer,
  height integer,
  created_at timestamptz default now()
);

create table if not exists public.media_clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  page_id uuid,
  asset_id uuid references public.media_assets(id) on delete cascade,
  start numeric not null default 0,
  duration numeric not null default 1,
  in numeric not null default 0,
  volume numeric not null default 1,
  muted boolean not null default false,
  created_at timestamptz default now()
);

-- Indexes for fast filtering
create index if not exists media_assets_project_idx on public.media_assets(project_id);
create index if not exists media_clips_project_page_idx on public.media_clips(project_id, page_id);

-- RLS policies (adjust as per your auth model)
alter table public.media_assets enable row level security;
alter table public.media_clips enable row level security;

create policy if not exists "media_assets_read_own" on public.media_assets
  for select using (auth.uid() is not null);

create policy if not exists "media_assets_write_own" on public.media_assets
  for insert with check (auth.uid() is not null);

create policy if not exists "media_clips_read_own" on public.media_clips
  for select using (auth.uid() is not null);

create policy if not exists "media_clips_write_own" on public.media_clips
  for insert with check (auth.uid() is not null);