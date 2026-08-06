import { readFile, readdir } from 'node:fs/promises';
import { newDb } from 'pg-mem';

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory)).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/i.test(file)).sort();
const migrations = await Promise.all(migrationFiles.map(file => readFile(new URL(file, migrationsDirectory), 'utf8')));
const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
for (const migration of migrations) db.public.none(migration);
for (const migration of migrations) db.public.none(migration);

const requiredTables = ['shipseal_users', 'shipseal_sessions', 'shipseal_projects', 'shipseal_scans', 'shipseal_verification_relationships', 'shipseal_schema_migrations'];
for (const table of requiredTables) {
  if (!db.public.getTable(table)) throw new Error(`Migration did not create ${table}.`);
}
const versions = db.public.many('select version from shipseal_schema_migrations order by version');
if (versions.length !== migrationFiles.length || versions.some((row, index) => `${row.version}.sql` !== migrationFiles[index])) throw new Error('Migration tracking is invalid.');
console.log(`Account migration test passed: ${requiredTables.length} tables, ${versions.length} idempotent migrations through ${versions.at(-1).version}.`);
