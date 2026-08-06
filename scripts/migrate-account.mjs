import { readFile, readdir } from 'node:fs/promises';
import postgres from 'postgres';

const connectionString = (process.env.DATABASE_URL || '').trim();
if (!connectionString) throw new Error('DATABASE_URL is required to run account migrations.');
if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory)).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/i.test(file)).sort();
const sql = postgres(connectionString, { max: 1, prepare: false });
try {
  for (const file of migrationFiles) await sql.unsafe(await readFile(new URL(file, migrationsDirectory), 'utf8'));
  const applied = await sql`select version from shipseal_schema_migrations order by version`;
  console.log(`Account persistence migrations applied: ${applied.map(row => row.version).join(', ')}`);
} finally {
  await sql.end({ timeout: 5 });
}
