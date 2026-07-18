begin;

create table if not exists shipseal_users (
  id text primary key,
  auth_provider text not null check (auth_provider = 'github'),
  provider_subject text not null,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  unique (auth_provider, provider_subject)
);

create table if not exists shipseal_sessions (
  id text primary key,
  user_id text not null references shipseal_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists shipseal_sessions_user_idx on shipseal_sessions(user_id, expires_at desc);

create table if not exists shipseal_projects (
  id text primary key,
  owner_user_id text not null references shipseal_users(id) on delete cascade,
  schema_version text not null,
  source_type text not null,
  repository_identity text not null,
  repository_owner text,
  repository_name text,
  upload_label text,
  default_branch text,
  github_repository_id text,
  github_installation_id text,
  display_name text not null,
  archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_scan_at timestamptz,
  deleted_at timestamptz
);
create unique index if not exists shipseal_projects_owner_identity_active_idx
  on shipseal_projects(owner_user_id, repository_identity) where deleted_at is null;
create index if not exists shipseal_projects_owner_listing_idx
  on shipseal_projects(owner_user_id, last_scan_at desc, created_at desc) where deleted_at is null;

create table if not exists shipseal_scans (
  id text primary key,
  project_id text not null references shipseal_projects(id) on delete cascade,
  owner_user_id text not null references shipseal_users(id) on delete cascade,
  schema_version text not null,
  snapshot_schema_version text not null,
  idempotency_key text not null,
  source_type text not null,
  repository_owner text,
  repository_name text,
  branch text,
  status text not null check (status in ('completed', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  scanner_version text not null,
  deterministic_request_fingerprint text not null,
  discovered_files integer not null check (discovered_files >= 0),
  analyzed_files integer not null check (analyzed_files >= 0),
  ignored_files integer not null check (ignored_files >= 0),
  intelligence_mode text not null check (intelligence_mode in ('deterministic', 'enhanced', 'fallback')),
  verification_state text not null,
  baseline_scan_id text references shipseal_scans(id) on delete set null,
  safe_failure_category text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);
create index if not exists shipseal_scans_project_listing_idx on shipseal_scans(project_id, completed_at desc, created_at desc);
create index if not exists shipseal_scans_owner_idx on shipseal_scans(owner_user_id, created_at desc);

create table if not exists shipseal_verification_relationships (
  id text primary key,
  owner_user_id text not null references shipseal_users(id) on delete cascade,
  project_id text not null references shipseal_projects(id) on delete cascade,
  baseline_scan_id text not null references shipseal_scans(id) on delete cascade,
  rescan_id text not null references shipseal_scans(id) on delete cascade,
  schema_version text not null,
  algorithm_version text not null,
  state text not null,
  verified_at timestamptz,
  expected_artifact_ids jsonb not null,
  created_at timestamptz not null,
  unique (baseline_scan_id, rescan_id, algorithm_version)
);
create index if not exists shipseal_verification_project_idx on shipseal_verification_relationships(project_id, created_at desc);

create table if not exists shipseal_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
insert into shipseal_schema_migrations(version) values ('0001_account_persistence') on conflict do nothing;

commit;
