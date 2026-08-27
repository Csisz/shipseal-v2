begin;

create table if not exists public.shipseal_billing_customers (
  user_id text primary key references public.shipseal_users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipseal_billing_subscriptions (
  user_id text primary key references public.shipseal_billing_customers(user_id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null references public.shipseal_billing_customers(stripe_customer_id) on delete cascade,
  stripe_price_id text not null,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  subscription_created_at timestamptz not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  latest_event_created bigint not null check (latest_event_created >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);

create table if not exists public.shipseal_billing_events (
  event_id text primary key,
  event_type text not null,
  user_id text references public.shipseal_users(id) on delete set null,
  stripe_created_at bigint not null check (stripe_created_at >= 0),
  processed_at timestamptz not null default now()
);
create index if not exists shipseal_billing_events_user_idx
  on public.shipseal_billing_events(user_id, processed_at desc) where user_id is not null;

alter table public.shipseal_billing_customers enable row level security;
alter table public.shipseal_billing_subscriptions enable row level security;
alter table public.shipseal_billing_events enable row level security;

revoke all privileges on table
  public.shipseal_billing_customers,
  public.shipseal_billing_subscriptions,
  public.shipseal_billing_events
from public;

do $shipseal_billing_security$
declare
  untrusted_role text;
begin
  foreach untrusted_role in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (
      select 1 from pg_catalog.pg_roles where rolname = untrusted_role
    ) then
      execute format(
        'revoke all privileges on table public.shipseal_billing_customers, public.shipseal_billing_subscriptions, public.shipseal_billing_events from %I',
        untrusted_role
      );
    end if;
  end loop;
end
$shipseal_billing_security$;

insert into public.shipseal_schema_migrations(version)
values ('0005_billing')
on conflict do nothing;

commit;
