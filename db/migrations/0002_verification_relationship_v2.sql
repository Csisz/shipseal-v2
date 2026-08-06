begin;

alter table shipseal_verification_relationships
  add column if not exists prepared_plan_id text,
  add column if not exists prepared_plan_fingerprint text,
  add column if not exists applied_operation_id text,
  add column if not exists pull_request_url text,
  add column if not exists branch text,
  add column if not exists repository_identity text,
  add column if not exists measurement_version text,
  add column if not exists expected_statement_ids jsonb not null default '[]'::jsonb,
  add column if not exists evidence jsonb,
  add column if not exists relationship_fingerprint text;

create unique index if not exists shipseal_verification_relationship_fingerprint_idx
  on shipseal_verification_relationships(owner_user_id, relationship_fingerprint)
  where relationship_fingerprint is not null;

create index if not exists shipseal_verification_later_scan_idx
  on shipseal_verification_relationships(owner_user_id, rescan_id, created_at desc);

insert into shipseal_schema_migrations(version)
values ('0002_verification_relationship_v2')
on conflict do nothing;

commit;
