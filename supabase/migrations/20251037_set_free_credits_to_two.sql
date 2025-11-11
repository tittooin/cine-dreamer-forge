-- Set daily free credits to 2 across defaults and existing rows

-- Update global defaults (if present)
update public.app_settings
set daily_default = 2,
    updated_at = now()
where key = 'default_limits';

-- Update per-user daily limit to 2 (optional, keeps consistency)
update public.user_limits
set daily_limit = 2,
    updated_at = now()
where coalesce(daily_limit, 0) <> 2;

-- Change default free_remaining to 2 and normalize existing rows
alter table public.image_credits
  alter column free_remaining set default 2;

update public.image_credits
set free_remaining = 2,
    updated_at = now()
where coalesce(free_remaining, 0) <> 2;