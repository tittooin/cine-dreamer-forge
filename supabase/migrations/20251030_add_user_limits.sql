-- Per-user daily limit configuration table
create table if not exists public.user_limits (
  user_id text primary key,
  daily_limit integer not null default 100,
  updated_at timestamptz not null default now()
);

comment on table public.user_limits is 'Per-user daily generation limits override the global DAILY_IMAGE_LIMIT.';
comment on column public.user_limits.user_id is 'Supabase auth user id.';
comment on column public.user_limits.daily_limit is 'Max allowed generations per day for this user.';