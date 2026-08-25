begin;

create table if not exists public.shipseal_entitlements (
  user_id text primary key references public.shipseal_users(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'team', 'internal')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'expired', 'disabled')),
  repository_futures boolean not null default false,
  executable_future_plan boolean not null default true,
  deep_analysis_limit integer not null check (deep_analysis_limit >= 0 and deep_analysis_limit <= 100000),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source text not null check (source in ('default', 'internal', 'billing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.shipseal_ai_operations (
  id text primary key,
  public_operation_id text not null unique,
  owner_user_id text not null references public.shipseal_users(id) on delete cascade,
  project_id text references public.shipseal_projects(id) on delete set null,
  operation_kind text not null check (operation_kind in ('repository_futures', 'repository_deep_intelligence')),
  logical_analysis_fingerprint text not null,
  repository_identity text not null,
  request_fingerprint text not null,
  pipeline_version text not null,
  execution_profile text not null,
  state text not null check (state in ('reserved', 'running', 'succeeded', 'retryable_failure', 'terminal_failure')),
  reserved_user_units integer not null default 0 check (reserved_user_units between 0 and 1),
  consumed_user_units integer not null default 0 check (consumed_user_units between 0 and 1),
  provider_attempt_count integer not null default 0 check (provider_attempt_count >= 0),
  last_attempt_at timestamptz,
  terminal_failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  released_at timestamptz,
  unique (owner_user_id, operation_kind, logical_analysis_fingerprint),
  check (reserved_user_units + consumed_user_units <= 1)
);
create index if not exists shipseal_ai_operations_owner_period_idx
  on public.shipseal_ai_operations(owner_user_id, created_at desc);
create index if not exists shipseal_ai_operations_project_idx
  on public.shipseal_ai_operations(project_id, created_at desc) where project_id is not null;

create table if not exists public.shipseal_ai_operation_stages (
  id text primary key,
  operation_id text not null references public.shipseal_ai_operations(id) on delete cascade,
  stage_kind text not null check (stage_kind in ('analysis', 'roots', 'expansion')),
  stage_fingerprint text not null,
  state text not null check (state in ('authorized', 'running', 'succeeded', 'retryable_failure', 'terminal_failure')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_call_count integer not null default 0 check (provider_call_count >= 0),
  lease_id text,
  lease_expires_at timestamptz,
  cached_response jsonb,
  last_failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  unique (operation_id, stage_fingerprint)
);
create index if not exists shipseal_ai_operation_stages_lease_idx
  on public.shipseal_ai_operation_stages(state, lease_expires_at) where state = 'running';

create table if not exists public.shipseal_ai_usage_ledger (
  id text primary key,
  owner_user_id text not null references public.shipseal_users(id) on delete cascade,
  operation_id text not null references public.shipseal_ai_operations(id) on delete cascade,
  entry_kind text not null check (entry_kind in ('reservation', 'consumption', 'release')),
  reserved_unit_delta integer not null,
  consumed_unit_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (
    (entry_kind = 'reservation' and reserved_unit_delta = 1 and consumed_unit_delta = 0) or
    (entry_kind = 'consumption' and reserved_unit_delta = -1 and consumed_unit_delta = 1) or
    (entry_kind = 'release' and reserved_unit_delta = -1 and consumed_unit_delta = 0)
  )
);
create index if not exists shipseal_ai_usage_ledger_owner_idx
  on public.shipseal_ai_usage_ledger(owner_user_id, created_at desc);
create index if not exists shipseal_ai_usage_ledger_operation_idx
  on public.shipseal_ai_usage_ledger(operation_id, created_at asc);

create table if not exists public.shipseal_ai_budget_windows (
  window_key date primary key,
  provider_call_limit integer not null check (provider_call_limit > 0),
  provider_call_count integer not null default 0 check (provider_call_count >= 0),
  in_flight_count integer not null default 0 check (in_flight_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipseal_ai_provider_permits (
  id text primary key,
  window_key date not null references public.shipseal_ai_budget_windows(window_key) on delete restrict,
  operation_id text references public.shipseal_ai_operations(id) on delete set null,
  stage_id text references public.shipseal_ai_operation_stages(id) on delete set null,
  state text not null check (state in ('acquired', 'released', 'expired')),
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  released_at timestamptz,
  check (expires_at > acquired_at)
);
create index if not exists shipseal_ai_provider_permits_active_idx
  on public.shipseal_ai_provider_permits(window_key, expires_at) where state = 'acquired';

alter table public.shipseal_entitlements enable row level security;
alter table public.shipseal_ai_operations enable row level security;
alter table public.shipseal_ai_operation_stages enable row level security;
alter table public.shipseal_ai_usage_ledger enable row level security;
alter table public.shipseal_ai_budget_windows enable row level security;
alter table public.shipseal_ai_provider_permits enable row level security;

revoke all privileges on table
  public.shipseal_entitlements,
  public.shipseal_ai_operations,
  public.shipseal_ai_operation_stages,
  public.shipseal_ai_usage_ledger,
  public.shipseal_ai_budget_windows,
  public.shipseal_ai_provider_permits
from public;

do $shipseal_ai_security$
declare
  untrusted_role text;
begin
  foreach untrusted_role in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (
      select 1 from pg_catalog.pg_roles where rolname = untrusted_role
    ) then
      execute format(
        'revoke all privileges on table public.shipseal_entitlements, public.shipseal_ai_operations, public.shipseal_ai_operation_stages, public.shipseal_ai_usage_ledger, public.shipseal_ai_budget_windows, public.shipseal_ai_provider_permits from %I',
        untrusted_role
      );
    end if;
  end loop;
end
$shipseal_ai_security$;

insert into public.shipseal_schema_migrations(version)
values ('0004_entitlements_ai_usage')
on conflict do nothing;

commit;
