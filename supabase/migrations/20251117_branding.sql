-- Branding: brand_kits table and RLS
create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.brand_kits enable row level security;

-- Owners can insert their kits
create policy brand_kits_insert
  on public.brand_kits for insert
  with check ( auth.uid() = user_id );

-- Owners can select their kits
create policy brand_kits_select
  on public.brand_kits for select
  using ( auth.uid() = user_id );

-- Owners can update their kits
create policy brand_kits_update
  on public.brand_kits for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- Owners can delete their kits
create policy brand_kits_delete
  on public.brand_kits for delete
  using ( auth.uid() = user_id );