begin;

alter table public.shipseal_users enable row level security;
alter table public.shipseal_sessions enable row level security;
alter table public.shipseal_projects enable row level security;
alter table public.shipseal_scans enable row level security;
alter table public.shipseal_verification_relationships enable row level security;
alter table public.shipseal_schema_migrations enable row level security;

revoke all privileges on table
  public.shipseal_users,
  public.shipseal_sessions,
  public.shipseal_projects,
  public.shipseal_scans,
  public.shipseal_verification_relationships,
  public.shipseal_schema_migrations
from public;

do $shipseal_security$
declare
  untrusted_role text;
begin
  foreach untrusted_role in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = untrusted_role
    ) then
      execute format(
        'revoke all privileges on table public.shipseal_users, public.shipseal_sessions, public.shipseal_projects, public.shipseal_scans, public.shipseal_verification_relationships, public.shipseal_schema_migrations from %I',
        untrusted_role
      );
    end if;
  end loop;
end
$shipseal_security$;

insert into public.shipseal_schema_migrations(version)
values ('0003_database_security_hardening')
on conflict do nothing;

commit;
