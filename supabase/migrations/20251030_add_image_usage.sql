-- Create table for per-user daily usage tracking
create table if not exists public.image_usage (
  user_id text not null,
  period_start date not null,
  count integer not null default 0,
  constraint image_usage_pk primary key (user_id, period_start)
);

comment on table public.image_usage is 'Tracks daily image generation counts per user for rate limiting.';
comment on column public.image_usage.user_id is 'Opaque user identifier (e.g., auth user id or app-defined).';
comment on column public.image_usage.period_start is 'UTC date for the usage period (YYYY-MM-DD).';
comment on column public.image_usage.count is 'Number of successful generations on this day.';

-- Helpful index for querying by date ranges if needed later
create index if not exists image_usage_period_idx on public.image_usage (period_start);