-- Extend payments table for gateway (Cashfree) integration
alter table public.payments
  add column if not exists provider text not null default 'upi-direct',
  add column if not exists order_id text,
  add column if not exists provider_link text,
  add column if not exists provider_signature text;

comment on column public.payments.provider is 'Payment provider identifier (e.g., cashfree, upi-direct).';
comment on column public.payments.order_id is 'Gateway order id for reconciliation.';
comment on column public.payments.provider_link is 'Hosted checkout/payment link URL from provider.';
comment on column public.payments.provider_signature is 'Optional signature/token from provider.';

create index if not exists payments_order_idx on public.payments(order_id);