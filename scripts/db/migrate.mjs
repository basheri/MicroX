// Numbered, reversible migration runner (rule 30-database-and-data).
// Applies up migrations in `supabase/migrations/*.sql` in lexical order, each in a
// transaction, tracking applied versions in `schema_migrations`. `--down` rolls the
// last batch back using the matching files in `supabase/migrations/down/`.
//
// Usage:
//   node scripts/db/migrate.mjs            # apply all pending up migrations
//   node scripts/db/migrate.mjs --down     # roll back the most recent migration
//   node scripts/db/migrate.mjs --reset    # drop+recreate public schema, then apply all
//
// Reads DATABASE_URL (or the first CLI arg as a connection string).

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const DOWN_DIR = join(MIGRATIONS_DIR, "down");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);

export function listUpMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function versionOf(filename) {
  return filename.split("_")[0];
}

export async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

export async function applyAll(client, { reset = false } = {}) {
  if (reset) {
    await client.query("drop schema if exists public cascade; create schema public;");
    await client.query("drop schema if exists app cascade;");
  }
  await ensureMigrationsTable(client);
  const applied = new Set(
    (await client.query("select version from schema_migrations")).rows.map((r) => r.version),
  );
  const pending = listUpMigrations().filter((f) => !applied.has(versionOf(f)));
  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(version, filename) values ($1,$2)", [
        versionOf(file),
        file,
      ]);
      await client.query("commit");
      console.log(`applied  ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
  return pending;
}

export async function rollbackLast(client) {
  await ensureMigrationsTable(client);
  const last = (
    await client.query(
      "select version, filename from schema_migrations order by version desc limit 1",
    )
  ).rows[0];
  if (!last) {
    console.log("nothing to roll back");
    return null;
  }
  const downFile = last.filename.replace(/\.sql$/, ".down.sql");
  const sql = readFileSync(join(DOWN_DIR, downFile), "utf8");
  await client.query("begin");
  try {
    // Remove the tracking row first: a baseline teardown may drop the whole public
    // schema (including schema_migrations), so deleting after the down would fail.
    await client.query("delete from schema_migrations where version = $1", [last.version]);
    await client.query(sql);
    await client.query("commit");
    console.log(`rolled back  ${last.filename}`);
  } catch (err) {
    await client.query("rollback");
    throw new Error(`rollback ${downFile} failed: ${err.message}`);
  }
  return last.version;
}

// CLI entry — only runs when invoked directly, not when imported by tests.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const connectionString = args.find((a) => a.startsWith("postgres")) ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No connection string. Set DATABASE_URL or pass one as an argument.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    if (flag("--down")) await rollbackLast(client);
    else await applyAll(client, { reset: flag("--reset") });
  } finally {
    await client.end();
  }
}
