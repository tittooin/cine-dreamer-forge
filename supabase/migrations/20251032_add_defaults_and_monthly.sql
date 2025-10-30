-- Global defaults for new users and monthly limit support
create table if not exists public.app_settings (
  key text primary key,
  daily_default integer not null default 10,
  monthly_default integer not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(key, daily_default, monthly_default)
values ('default_limits', 10, 100)
on conflict (key) do update set
  daily_default = excluded.daily_default,
  monthly_default = excluded.monthly_default,
  updated_at = now();

alter table public.user_limits
  add column if not exists monthly_limit integer not null default 100;

comment on table public.app_settings is 'Application settings including default limits for new users.';
comment on column public.app_settings.daily_default is 'Default daily images for users without overrides.';
comment on column public.app_settings.monthly_default is 'Default monthly images for users without overrides.';
comment on column public.user_limits.monthly_limit is 'Per-user monthly generation limit.';