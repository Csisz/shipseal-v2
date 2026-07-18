import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const connectionString = (process.env.DATABASE_URL || '').trim();
if (!connectionString) throw new Error('DATABASE_URL is required to run account migrations.');
if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');

const migration = await readFile(new URL('../db/migrations/0001_account_persistence.sql', import.meta.url), 'utf8');
const sql = postgres(connectionString, { max: 1, prepare: false });
try {
  await sql.unsafe(migration);
  const applied = await sql`select version from shipseal_schema_migrations order by version`;
  console.log(`Account persistence migrations applied: ${applied.map(row => row.version).join(', ')}`);
} finally {
  await sql.end({ timeout: 5 });
}

