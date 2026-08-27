begin;

alter table public.shipseal_ai_operations
  add column if not exists canonical_root_response jsonb,
  add column if not exists canonical_root_stage_fingerprint text,
  add column if not exists canonical_root_contract_version text,
  add column if not exists integrity_recovery_attempt_count integer not null default 0,
  add column if not exists integrity_recovery_started_at timestamptz,
  add column if not exists integrity_recovered_at timestamptz;

alter table public.shipseal_ai_operations
  drop constraint if exists shipseal_ai_operations_integrity_recovery_attempt_count_check;
alter table public.shipseal_ai_operations
  add constraint shipseal_ai_operations_integrity_recovery_attempt_count_check
  check (integrity_recovery_attempt_count between 0 and 1);

alter table public.shipseal_ai_operation_stages
  add column if not exists integrity_recovery boolean not null default false;

create index if not exists shipseal_ai_operations_owner_repository_idx
  on public.shipseal_ai_operations(owner_user_id, repository_identity, created_at desc);

insert into public.shipseal_schema_migrations(version)
values ('0006_durable_ai_recovery')
on conflict do nothing;

commit;
