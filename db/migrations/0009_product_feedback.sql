begin;

create table if not exists public.shipseal_product_feedback (
  id text primary key,
  user_id text references public.shipseal_users(id) on delete set null,
  project_id text references public.shipseal_projects(id) on delete set null,
  scan_id text references public.shipseal_scans(id) on delete set null,
  surface text not null check (surface in ('global','scan_result','repository_futures','executable_plan','agent_handoff','delivery','projects','account')),
  use_case text not null check (use_case in ('understand_repository','find_improvements','plan_future','prepare_agent_work','prepare_delivery','other')),
  outcome text not null check (outcome in ('yes','partly','no')),
  use_again text not null check (use_again in ('yes','maybe','no')),
  pricing_intent text check (pricing_intent is null or pricing_intent in ('yes','maybe','no')),
  comment text check (comment is null or char_length(comment) <= 2000),
  contact_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shipseal_product_feedback_created_idx on public.shipseal_product_feedback(created_at desc);
create index if not exists shipseal_product_feedback_outcome_idx on public.shipseal_product_feedback(outcome, created_at desc);
alter table public.shipseal_product_feedback enable row level security;
revoke all privileges on table public.shipseal_product_feedback from public;

alter table public.shipseal_operational_events drop constraint if exists shipseal_operational_events_category_check;
alter table public.shipseal_operational_events add constraint shipseal_operational_events_category_check
  check (category in ('auth','github','ingestion','scan','persistence','ai_operation','ai_stage','provider','billing','stripe_webhook','github_mutation','export','system','product'));

insert into public.shipseal_schema_migrations(version) values ('0009_product_feedback') on conflict do nothing;
commit;
