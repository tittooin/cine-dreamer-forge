-- Create table to track free and paid image credits per user
create table if not exists image_credits (
  user_id text primary key,
  free_remaining int not null default 5,
  paid_credits int not null default 0,
  updated_at timestamptz not null default now()
);

-- Helpful index
create index if not exists idx_image_credits_updated on image_credits(updated_at);