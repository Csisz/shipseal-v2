import { readFile, readdir } from 'node:fs/promises';
import { newDb } from 'pg-mem';

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory)).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/i.test(file)).sort();
const migrations = await Promise.all(migrationFiles.map(file => readFile(new URL(file, migrationsDirectory), 'utf8')));
const securityMigrationFile = '0003_database_security_hardening.sql';
const securityMigrationIndex = migrationFiles.indexOf(securityMigrationFile);
if (securityMigrationIndex === -1) throw new Error(`${securityMigrationFile} is missing.`);
const aiSecurityMigrationFile = '0004_entitlements_ai_usage.sql';
const aiSecurityMigrationIndex = migrationFiles.indexOf(aiSecurityMigrationFile);
if (aiSecurityMigrationIndex === -1) throw new Error(`${aiSecurityMigrationFile} is missing.`);
const billingSecurityMigrationFile = '0005_billing.sql';
const billingSecurityMigrationIndex = migrationFiles.indexOf(billingSecurityMigrationFile);
if (billingSecurityMigrationIndex === -1) throw new Error(`${billingSecurityMigrationFile} is missing.`);
const recoveryMigrationFile = '0006_durable_ai_recovery.sql';
const recoveryMigrationIndex = migrationFiles.indexOf(recoveryMigrationFile);
if (recoveryMigrationIndex === -1) throw new Error(`${recoveryMigrationFile} is missing.`);

const securityMigration = migrations[securityMigrationIndex];
const aiSecurityMigration = migrations[aiSecurityMigrationIndex];
const billingSecurityMigration = migrations[billingSecurityMigrationIndex];
const recoveryMigration = migrations[recoveryMigrationIndex];
const accountTables = ['shipseal_users', 'shipseal_sessions', 'shipseal_projects', 'shipseal_scans', 'shipseal_verification_relationships', 'shipseal_schema_migrations'];
const aiTables = ['shipseal_entitlements', 'shipseal_ai_operations', 'shipseal_ai_operation_stages', 'shipseal_ai_usage_ledger', 'shipseal_ai_budget_windows', 'shipseal_ai_provider_permits'];
const billingTables = ['shipseal_billing_customers', 'shipseal_billing_subscriptions', 'shipseal_billing_events'];
const requiredTables = [...accountTables, ...aiTables, ...billingTables];
const normalizedSecurityMigration = securityMigration.replace(/\s+/g, ' ').trim().toLowerCase();
const rlsTables = [...securityMigration.matchAll(/alter\s+table\s+(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map(match => match[1]);
const publicRevoke = securityMigration.match(/revoke\s+all\s+privileges\s+on\s+table([\s\S]*?)from\s+public\s*;/i)?.[1] ?? '';
const conditionalRevoke = securityMigration.match(/execute\s+format\(\s*'([^']+)'/i)?.[1] ?? '';

if (new Set(rlsTables).size !== accountTables.length || accountTables.some(table => !rlsTables.includes(table))) {
  throw new Error('Security migration must enable RLS on every ShipSeal persistence table exactly once.');
}
if (/force\s+row\s+level\s+security/i.test(securityMigration)) throw new Error('Security migration must not force RLS for the trusted table owner.');
if (/create\s+policy|alter\s+policy/i.test(securityMigration)) throw new Error('Security migration must not add an RLS policy.');
if (/\b(drop|truncate|delete|disable\s+row\s+level\s+security)\b/i.test(securityMigration)) throw new Error('Security migration must remain forward-only and non-destructive.');
if (/\bgrant\b/i.test(securityMigration)) throw new Error('Security migration must not grant table access.');
if (!publicRevoke) throw new Error('Security migration must revoke direct PUBLIC table privileges.');
for (const table of accountTables) {
  if (!new RegExp(`(?:public\\.)?${table}\\b`, 'i').test(publicRevoke)) throw new Error(`PUBLIC revocation is missing ${table}.`);
  if (!new RegExp(`public\\.${table}\\b`, 'i').test(conditionalRevoke)) throw new Error(`Conditional Supabase-role revocation is missing ${table}.`);
}
if (!/from\s+%i\b/i.test(conditionalRevoke)) throw new Error('Conditional role revocation must quote the discovered role identifier.');
for (const role of ['anon', 'authenticated', 'service_role']) {
  if (!new RegExp(`['\"]${role}['\"]`, 'i').test(securityMigration)) throw new Error(`Security migration does not cover ${role}.`);
}
if (!/pg_catalog\.pg_roles/i.test(securityMigration) || !/if\s+exists/i.test(securityMigration)) {
  throw new Error('Supabase role revocation must be conditional for portable PostgreSQL environments.');
}
if (!normalizedSecurityMigration.includes("values ('0003_database_security_hardening') on conflict do nothing")) {
  throw new Error('Security migration tracking must be idempotent.');
}

const normalizedAiSecurityMigration = aiSecurityMigration.replace(/\s+/g, ' ').trim().toLowerCase();
const aiRlsTables = [...aiSecurityMigration.matchAll(/alter\s+table\s+(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map(match => match[1]);
const aiPublicRevoke = aiSecurityMigration.match(/revoke\s+all\s+privileges\s+on\s+table([\s\S]*?)from\s+public\s*;/i)?.[1] ?? '';
const aiConditionalRevoke = aiSecurityMigration.match(/execute\s+format\(\s*'([^']+)'/i)?.[1] ?? '';
if (new Set(aiRlsTables).size !== aiTables.length || aiTables.some(table => !aiRlsTables.includes(table))) {
  throw new Error('Entitlement migration must enable RLS on every new AI usage table exactly once.');
}
if (/force\s+row\s+level\s+security|create\s+policy|alter\s+policy|\bgrant\b/i.test(aiSecurityMigration)) {
  throw new Error('Entitlement migration must preserve the server-owner/default-deny security posture.');
}
if (/\b(drop|truncate|delete\s+from|disable\s+row\s+level\s+security)\b/i.test(aiSecurityMigration)) {
  throw new Error('Entitlement migration must remain forward-only and non-destructive.');
}
for (const table of aiTables) {
  if (!new RegExp(`(?:public\\.)?${table}\\b`, 'i').test(aiPublicRevoke)) throw new Error(`AI PUBLIC revocation is missing ${table}.`);
  if (!new RegExp(`public\\.${table}\\b`, 'i').test(aiConditionalRevoke)) throw new Error(`AI conditional role revocation is missing ${table}.`);
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  if (!new RegExp(`['\"]${role}['\"]`, 'i').test(aiSecurityMigration)) throw new Error(`AI security migration does not cover ${role}.`);
}
if (!normalizedAiSecurityMigration.includes("values ('0004_entitlements_ai_usage') on conflict do nothing")) {
  throw new Error('Entitlement migration tracking must be idempotent.');
}
if (!/unique\s*\(\s*owner_user_id\s*,\s*operation_kind\s*,\s*logical_analysis_fingerprint\s*\)/i.test(aiSecurityMigration)) {
  throw new Error('Logical AI operations must have an owner-scoped uniqueness constraint.');
}
if (!/unique\s*\(\s*operation_id\s*,\s*stage_fingerprint\s*\)/i.test(aiSecurityMigration)) {
  throw new Error('AI operation stages must be unique within their logical operation.');
}
if (!/reserved_user_units\s*\+\s*consumed_user_units\s*<=\s*1/i.test(aiSecurityMigration)) {
  throw new Error('One logical AI operation must never hold more than one user-facing unit.');
}

const normalizedBillingSecurityMigration = billingSecurityMigration.replace(/\s+/g, ' ').trim().toLowerCase();
const billingRlsTables = [...billingSecurityMigration.matchAll(/alter\s+table\s+(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map(match => match[1]);
const billingPublicRevoke = billingSecurityMigration.match(/revoke\s+all\s+privileges\s+on\s+table([\s\S]*?)from\s+public\s*;/i)?.[1] ?? '';
const billingConditionalRevoke = billingSecurityMigration.match(/execute\s+format\(\s*'([^']+)'/i)?.[1] ?? '';
if (new Set(billingRlsTables).size !== billingTables.length || billingTables.some(table => !billingRlsTables.includes(table))) {
  throw new Error('Billing migration must enable RLS on every billing table exactly once.');
}
if (/force\s+row\s+level\s+security|create\s+policy|alter\s+policy|\bgrant\b/i.test(billingSecurityMigration)) {
  throw new Error('Billing migration must preserve the server-owner/default-deny security posture.');
}
if (/\b(drop|truncate|delete\s+from|disable\s+row\s+level\s+security)\b/i.test(billingSecurityMigration)) {
  throw new Error('Billing migration must remain forward-only and non-destructive.');
}
for (const table of billingTables) {
  if (!new RegExp(`(?:public\\.)?${table}\\b`, 'i').test(billingPublicRevoke)) throw new Error(`Billing PUBLIC revocation is missing ${table}.`);
  if (!new RegExp(`public\\.${table}\\b`, 'i').test(billingConditionalRevoke)) throw new Error(`Billing conditional role revocation is missing ${table}.`);
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  if (!new RegExp(`['\"]${role}['\"]`, 'i').test(billingSecurityMigration)) throw new Error(`Billing security migration does not cover ${role}.`);
}
if (!normalizedBillingSecurityMigration.includes("values ('0005_billing') on conflict do nothing")) {
  throw new Error('Billing migration tracking must be idempotent.');
}
if (!/event_id\s+text\s+primary\s+key/i.test(billingSecurityMigration)) throw new Error('Stripe event idempotency storage is missing.');

const normalizedRecoveryMigration = recoveryMigration.replace(/\s+/g, ' ').trim().toLowerCase();
if (/\b(truncate|delete\s+from|disable\s+row\s+level\s+security|grant)\b/i.test(recoveryMigration)) {
  throw new Error('Durable recovery migration must remain additive and preserve default-deny security.');
}
for (const column of ['canonical_root_response', 'canonical_root_stage_fingerprint', 'integrity_recovery_attempt_count', 'integrity_recovery_started_at', 'integrity_recovered_at']) {
  if (!normalizedRecoveryMigration.includes(`add column if not exists ${column}`)) throw new Error(`Durable recovery column ${column} is missing.`);
}
if (!/integrity_recovery_attempt_count\s+between\s+0\s+and\s+1/i.test(recoveryMigration)) throw new Error('Integrity recovery must be bounded to one persisted attempt.');
if (!normalizedRecoveryMigration.includes("values ('0006_durable_ai_recovery') on conflict do nothing")) throw new Error('Durable recovery migration tracking must be idempotent.');

// pg-mem does not implement PostgreSQL RLS, privileges, roles, or PL/pgSQL DO
// blocks. Validate that production-only contract above, then omit exactly those
// statements while exercising the remaining migration and schema behavior twice.
function forPgMem(file, migration) {
  if (![securityMigrationFile, aiSecurityMigrationFile, billingSecurityMigrationFile].includes(file)) return migration;
  const blockName = file === securityMigrationFile ? 'shipseal_security' : file === aiSecurityMigrationFile ? 'shipseal_ai_security' : 'shipseal_billing_security';
  return migration
    .replace(/alter\s+table\s+(?:public\.)?[a-z0-9_]+\s+enable\s+row\s+level\s+security\s*;/gi, '')
    .replace(/revoke\s+all\s+privileges\s+on\s+table[\s\S]*?from\s+public\s*;/i, '')
    .replace(new RegExp(`do\\s+\\$${blockName}\\$[\\s\\S]*?\\$${blockName}\\$\\s*;`, 'i'), '');
}

const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
const pgMemMigrations = migrations.map((migration, index) => forPgMem(migrationFiles[index], migration));
for (const migration of pgMemMigrations) db.public.none(migration);
for (const migration of pgMemMigrations) db.public.none(migration);

for (const table of requiredTables) {
  if (!db.public.getTable(table)) throw new Error(`Migration did not create ${table}.`);
}
const versions = db.public.many('select version from shipseal_schema_migrations order by version');
if (versions.length !== migrationFiles.length || versions.some((row, index) => `${row.version}.sql` !== migrationFiles[index])) throw new Error('Migration tracking is invalid.');

const verificationColumns = db.public.many(`
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'shipseal_verification_relationships'
`);
for (const column of ['prepared_plan_id', 'relationship_fingerprint', 'expected_statement_ids']) {
  if (!verificationColumns.some(row => row.column_name === column)) throw new Error(`Existing 0002 column ${column} is missing.`);
}

// These operations run as pg-mem's database owner. PostgreSQL table owners also
// retain access with ENABLE RLS (without FORCE), which is ShipSeal's DATABASE_URL model.
db.public.none(`
  insert into shipseal_users(id, auth_provider, provider_subject, created_at, updated_at)
  values ('security-test-user', 'github', 'security-test-subject', now(), now());
  insert into shipseal_sessions(id, user_id, token_hash, created_at, expires_at)
  values ('security-test-session', 'security-test-user', 'security-test-hash', now(), now() + interval '1 day');
  insert into shipseal_projects(
    id, owner_user_id, schema_version, source_type, repository_identity, display_name, created_at, updated_at
  ) values (
    'security-test-project', 'security-test-user', 'shipseal.project.v1', 'upload', 'upload:security-test', 'Security test', now(), now()
  );
  update shipseal_projects set display_name = 'Security test updated' where id = 'security-test-project';
`);
const ownerProject = db.public.one("select display_name from shipseal_projects where id = 'security-test-project'");
if (ownerProject.display_name !== 'Security test updated') throw new Error('Trusted owner persistence operations failed after migrations.');

db.public.none(`
  insert into shipseal_entitlements(
    user_id, plan, status, repository_futures, executable_future_plan, deep_analysis_limit,
    period_start, period_end, source
  ) values (
    'security-test-user', 'internal', 'active', true, true, 2,
    now(), now() + interval '30 days', 'internal'
  );
  insert into shipseal_ai_operations(
    id, public_operation_id, owner_user_id, project_id, operation_kind, logical_analysis_fingerprint,
    repository_identity, request_fingerprint, pipeline_version, execution_profile, state, reserved_user_units
  ) values (
    'ai-operation-security-test', 'op-security-test', 'security-test-user', 'security-test-project',
    'repository_futures', 'logical-security-test', 'upload:security-test', 'request-security-test',
    'pipeline-v1', 'product-strategist', 'reserved', 1
  );
  insert into shipseal_ai_operation_stages(
    id, operation_id, stage_kind, stage_fingerprint, state
  ) values (
    'ai-stage-security-test', 'ai-operation-security-test', 'roots', 'root-security-test', 'authorized'
  );
  insert into shipseal_ai_usage_ledger(
    id, owner_user_id, operation_id, entry_kind, reserved_unit_delta, consumed_unit_delta, reason
  ) values (
    'ai-ledger-security-test', 'security-test-user', 'ai-operation-security-test', 'reservation', 1, 0, 'migration-test'
  );
  insert into shipseal_ai_budget_windows(window_key, provider_call_limit) values ('2026-08-24', 10);
  insert into shipseal_ai_provider_permits(
    id, window_key, operation_id, stage_id, state, acquired_at, expires_at
  ) values (
    'ai-permit-security-test', '2026-08-24', 'ai-operation-security-test', 'ai-stage-security-test',
    'acquired', now(), now() + interval '3 minutes'
  );
  insert into shipseal_billing_customers(user_id, stripe_customer_id)
  values ('security-test-user', 'cus_security_test');
  insert into shipseal_billing_subscriptions(
    user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status,
    subscription_created_at, current_period_start, current_period_end, cancel_at_period_end, latest_event_created
  ) values (
    'security-test-user', 'sub_security_test', 'cus_security_test', 'price_security_test', 'active',
    now(), now(), now() + interval '30 days', false, 1777000000
  );
  insert into shipseal_billing_events(event_id, event_type, user_id, stripe_created_at)
  values ('evt_security_test', 'customer.subscription.updated', 'security-test-user', 1777000000);
`);
const operation = db.public.one("select reserved_user_units, consumed_user_units from shipseal_ai_operations where id = 'ai-operation-security-test'");
if (operation.reserved_user_units !== 1 || operation.consumed_user_units !== 0) throw new Error('AI usage operation constraints are not operational.');
const billingSubscription = db.public.one("select status, latest_event_created from shipseal_billing_subscriptions where user_id = 'security-test-user'");
if (billingSubscription.status !== 'active' || Number(billingSubscription.latest_event_created) !== 1777000000) throw new Error('Billing persistence constraints are not operational.');
try {
  db.public.none(`
    insert into shipseal_ai_operations(
      id, public_operation_id, owner_user_id, operation_kind, logical_analysis_fingerprint,
      repository_identity, request_fingerprint, pipeline_version, execution_profile, state
    ) values (
      'ai-operation-duplicate-test', 'op-duplicate-test', 'security-test-user', 'repository_futures',
      'logical-security-test', 'upload:security-test', 'request-security-test', 'pipeline-v1', 'product-strategist', 'running'
    )
  `);
  throw new Error('Owner-scoped logical operation uniqueness was not enforced.');
} catch (error) {
  if (error instanceof Error && error.message === 'Owner-scoped logical operation uniqueness was not enforced.') throw error;
}

console.log(
  `Account migration security test passed: ${requiredTables.length} RLS tables across account and AI usage domains, PUBLIC plus 3 conditional role revocations, ` +
  `${versions.length} idempotent migrations through ${versions.at(-1).version}, owner persistence operational.`,
);
