-- Payments table to track UPI QR/intent flows and credit grants
create table if not exists public.payments (
  payment_id text primary key,
  user_id text not null,
  amount numeric(10,2) not null,
  credits integer not null default 1,
  upi_tr text not null,
  status text not null default 'pending',
  utr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_chk check (status in ('pending','confirmed','rejected'))
);

comment on table public.payments is 'Tracks UPI payment intents and confirmations per user.';
comment on column public.payments.payment_id is 'Client-visible payment identifier used in UPI tr param.';
comment on column public.payments.user_id is 'Supabase auth user id initiating the payment.';
comment on column public.payments.amount is 'Payment amount in INR.';
comment on column public.payments.credits is 'Credits to grant on successful payment.';
comment on column public.payments.upi_tr is 'UPI transaction reference assigned by us (added to UPI URI).';
comment on column public.payments.status is 'Payment status: pending/confirmed/rejected.';
comment on column public.payments.utr is 'UPI Transaction Reference returned by app (user-provided for desktop fallback).';

create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);