// Integration-test database isolation. Each *.it.test.ts file gets its OWN throwaway
// database so the files can run in parallel without resetting each other's schema.
// Derives a maintenance ("postgres") URL from TEST_DATABASE_URL, then creates/drops a
// uniquely named database and applies all migrations into it.

import pg from "pg";
import { applyAll } from "../../scripts/db/migrate.mjs";

export interface IsolatedDb {
  url: string;
  pool: pg.Pool;
  admin: pg.Client; // connected to the isolated db (for direct assertions)
  teardown: () => Promise<void>;
}

function withDbName(base: string, dbName: string): string {
  const u = new URL(base);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export async function createIsolatedDb(name: string): Promise<IsolatedDb> {
  const base = process.env.TEST_DATABASE_URL!;
  const dbName = `microx_it_${name}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  // Create the database from the maintenance connection.
  const maintenance = new pg.Client({ connectionString: withDbName(base, "postgres") });
  await maintenance.connect();
  await maintenance.query(`drop database if exists ${dbName} with (force)`);
  await maintenance.query(`create database ${dbName}`);
  await maintenance.end();

  const url = withDbName(base, dbName);
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await applyAll(admin, { reset: false });

  const pool = new pg.Pool({ connectionString: url });

  return {
    url,
    pool,
    admin,
    teardown: async () => {
      await pool.end();
      await admin.end();
      const m = new pg.Client({ connectionString: withDbName(base, "postgres") });
      await m.connect();
      await m.query(`drop database if exists ${dbName} with (force)`);
      await m.end();
    },
  };
}
