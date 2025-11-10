create table if not exists public.ip_sessions (
  id bigserial primary key,
  ip_hash text not null,
  user_id uuid null,
  user_email text null,
  user_agent text null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_ip_sessions_hash_time
  on public.ip_sessions (ip_hash, recorded_at);

-- Optional RPC for efficient counting
create or replace function public.count_distinct_users_for_ip(ip_hash_input text, window_hours int)
returns int language plpgsql as $$
declare
  cutoff timestamptz := now() - make_interval(hours => window_hours);
  cnt int;
begin
  select count(distinct user_id) into cnt
  from public.ip_sessions
  where ip_hash = ip_hash_input and recorded_at >= cutoff;
  return coalesce(cnt, 0);
end;
$$;