begin;

alter table public.shipseal_ai_operations
  add column if not exists canonical_complete_response jsonb,
  add column if not exists canonical_complete_fingerprint text,
  add column if not exists complete_contract_version text,
  add column if not exists completed_at timestamptz,
  add column if not exists refunded_user_units integer not null default 0,
  add column if not exists reconciliation_outcome text,
  add column if not exists reconciled_at timestamptz;

alter table public.shipseal_ai_operations
  drop constraint if exists shipseal_ai_operations_refunded_user_units_check;
alter table public.shipseal_ai_operations
  add constraint shipseal_ai_operations_refunded_user_units_check
  check (refunded_user_units between 0 and consumed_user_units);

alter table public.shipseal_ai_operations
  drop constraint if exists shipseal_ai_operations_reconciliation_outcome_check;
alter table public.shipseal_ai_operations
  add constraint shipseal_ai_operations_reconciliation_outcome_check
  check (reconciliation_outcome is null or reconciliation_outcome in ('not-required', 'reconstructed', 'refunded', 'review-required'));

do $shipseal_ai_operation_identity$
declare
  existing_constraint text;
begin
  select constraint_name into existing_constraint
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'shipseal_ai_operations'
    and constraint_type = 'UNIQUE'
    and constraint_name <> 'shipseal_ai_operations_public_operation_id_key'
  order by constraint_name
  limit 1;
  if existing_constraint is not null then
    execute format('alter table public.shipseal_ai_operations drop constraint %I', existing_constraint);
  end if;
end
$shipseal_ai_operation_identity$;

create unique index if not exists shipseal_ai_operations_active_logical_identity_idx
  on public.shipseal_ai_operations(owner_user_id, operation_kind, logical_analysis_fingerprint)
  where state <> 'terminal_failure';

create table if not exists public.shipseal_ai_usage_adjustments (
  id text primary key,
  owner_user_id text not null references public.shipseal_users(id) on delete cascade,
  operation_id text not null references public.shipseal_ai_operations(id) on delete cascade,
  entry_kind text not null check (entry_kind = 'refund'),
  user_unit_delta integer not null check (user_unit_delta = -1),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (operation_id, entry_kind)
);
create index if not exists shipseal_ai_usage_adjustments_owner_idx
  on public.shipseal_ai_usage_adjustments(owner_user_id, created_at desc);

alter table public.shipseal_ai_usage_adjustments enable row level security;

revoke all privileges on table public.shipseal_ai_usage_adjustments from public;

do $shipseal_ai_integrity_security$
declare
  untrusted_role text;
begin
  foreach untrusted_role in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = untrusted_role) then
      execute format(
        'revoke all privileges on table public.shipseal_ai_usage_adjustments from %I',
        untrusted_role
      );
    end if;
  end loop;
end
$shipseal_ai_integrity_security$;

insert into public.shipseal_schema_migrations(version)
values ('0007_ai_billing_integrity')
on conflict do nothing;

commit;
