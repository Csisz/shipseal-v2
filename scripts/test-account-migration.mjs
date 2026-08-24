import { readFile, readdir } from 'node:fs/promises';
import { newDb } from 'pg-mem';

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory)).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/i.test(file)).sort();
const migrations = await Promise.all(migrationFiles.map(file => readFile(new URL(file, migrationsDirectory), 'utf8')));
const securityMigrationFile = '0003_database_security_hardening.sql';
const securityMigrationIndex = migrationFiles.indexOf(securityMigrationFile);
if (securityMigrationIndex === -1) throw new Error(`${securityMigrationFile} is missing.`);

const securityMigration = migrations[securityMigrationIndex];
const requiredTables = ['shipseal_users', 'shipseal_sessions', 'shipseal_projects', 'shipseal_scans', 'shipseal_verification_relationships', 'shipseal_schema_migrations'];
const normalizedSecurityMigration = securityMigration.replace(/\s+/g, ' ').trim().toLowerCase();
const rlsTables = [...securityMigration.matchAll(/alter\s+table\s+(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi)].map(match => match[1]);
const publicRevoke = securityMigration.match(/revoke\s+all\s+privileges\s+on\s+table([\s\S]*?)from\s+public\s*;/i)?.[1] ?? '';
const conditionalRevoke = securityMigration.match(/execute\s+format\(\s*'([^']+)'/i)?.[1] ?? '';

if (new Set(rlsTables).size !== requiredTables.length || requiredTables.some(table => !rlsTables.includes(table))) {
  throw new Error('Security migration must enable RLS on every ShipSeal persistence table exactly once.');
}
if (/force\s+row\s+level\s+security/i.test(securityMigration)) throw new Error('Security migration must not force RLS for the trusted table owner.');
if (/create\s+policy|alter\s+policy/i.test(securityMigration)) throw new Error('Security migration must not add an RLS policy.');
if (/\b(drop|truncate|delete|disable\s+row\s+level\s+security)\b/i.test(securityMigration)) throw new Error('Security migration must remain forward-only and non-destructive.');
if (/\bgrant\b/i.test(securityMigration)) throw new Error('Security migration must not grant table access.');
if (!publicRevoke) throw new Error('Security migration must revoke direct PUBLIC table privileges.');
for (const table of requiredTables) {
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

// pg-mem does not implement PostgreSQL RLS, privileges, roles, or PL/pgSQL DO
// blocks. Validate that production-only contract above, then omit exactly those
// statements while exercising the remaining migration and schema behavior twice.
function forPgMem(file, migration) {
  if (file !== securityMigrationFile) return migration;
  return migration
    .replace(/alter\s+table\s+(?:public\.)?[a-z0-9_]+\s+enable\s+row\s+level\s+security\s*;/gi, '')
    .replace(/revoke\s+all\s+privileges\s+on\s+table[\s\S]*?from\s+public\s*;/i, '')
    .replace(/do\s+\$shipseal_security\$[\s\S]*?\$shipseal_security\$\s*;/i, '');
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

console.log(
  `Account migration security test passed: ${requiredTables.length} RLS tables, PUBLIC plus 3 conditional role revocations, ` +
  `${versions.length} idempotent migrations through ${versions.at(-1).version}, owner persistence operational.`,
);
