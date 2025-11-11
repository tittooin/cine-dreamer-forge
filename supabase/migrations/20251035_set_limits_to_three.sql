-- Update global defaults and per-user limits to 3

-- Set daily default in app_settings to 3 if the key exists
update public.app_settings
set daily_default = 3,
    updated_at = now()
where key = 'default_limits';

-- Ensure monthly_default remains unchanged (only daily_default is updated)

-- Update existing user_limits rows to daily_limit = 3
update public.user_limits
set daily_limit = 3,
    updated_at = now()
where daily_limit <> 3;

-- Initialize/normalize image credits free_remaining to 3 for all users
update public.image_credits
set free_remaining = 3,
    updated_at = now()
where coalesce(free_remaining, 0) <> 3;