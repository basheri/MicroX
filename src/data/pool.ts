// Server-side Postgres access (EP-02). MicroX is a modular monolith on Supabase;
// the service layer reaches the database through this single pooled connection.
// Connection string = Supabase Postgres URL (DATABASE_URL), supplied via Vercel
// env vars (SEC-008) — never hard-coded. Queries are always parameterized (SEC-003).

import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — cannot connect to Postgres (see .env.example).");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

// Override the pool (used by integration tests to point at a throwaway database).
export function setPool(p: Pool): void {
  pool = p;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as never[]);
  return result.rows;
}

// Run a function inside a single transaction, rolling back on any error.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
