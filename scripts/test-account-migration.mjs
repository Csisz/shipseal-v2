import { readFile } from 'node:fs/promises';
import { newDb } from 'pg-mem';

const migration = await readFile(new URL('../db/migrations/0001_account_persistence.sql', import.meta.url), 'utf8');
const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
db.public.none(migration);
db.public.none(migration);

const requiredTables = ['shipseal_users', 'shipseal_sessions', 'shipseal_projects', 'shipseal_scans', 'shipseal_verification_relationships', 'shipseal_schema_migrations'];
for (const table of requiredTables) {
  if (!db.public.getTable(table)) throw new Error(`Migration did not create ${table}.`);
}
const versions = db.public.many('select version from shipseal_schema_migrations');
if (versions.length !== 1 || versions[0].version !== '0001_account_persistence') throw new Error('Migration tracking is invalid.');
console.log(`Account migration test passed: ${requiredTables.length} tables, idempotent apply, version ${versions[0].version}.`);
