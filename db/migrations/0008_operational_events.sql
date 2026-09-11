begin;

create table if not exists public.shipseal_operational_events (
  id text primary key,
  event_id text not null unique,
  category text not null check (category in ('auth','github','ingestion','scan','persistence','ai_operation','ai_stage','provider','billing','stripe_webhook','github_mutation','export','system')),
  action text not null,
  status text not null check (status in ('started','succeeded','failed','retryable','duplicate','ignored')),
  user_id text references public.shipseal_users(id) on delete set null,
  project_id text references public.shipseal_projects(id) on delete set null,
  scan_id text,
  public_operation_id text,
  stage text,
  safe_category text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  provider_calls integer check (provider_calls is null or provider_calls >= 0),
  deployment_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists shipseal_operational_events_created_idx on public.shipseal_operational_events(created_at desc);
create index if not exists shipseal_operational_events_operation_idx on public.shipseal_operational_events(public_operation_id, created_at desc) where public_operation_id is not null;
create index if not exists shipseal_operational_events_user_idx on public.shipseal_operational_events(user_id, created_at desc) where user_id is not null;
alter table public.shipseal_operational_events enable row level security;
revoke all privileges on table public.shipseal_operational_events from public;
insert into public.shipseal_schema_migrations(version) values ('0008_operational_events') on conflict do nothing;
commit;
