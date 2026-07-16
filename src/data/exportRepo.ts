// Export package data layer (EP-21). Records the assembled submission package with its
// index manifest and storage path. Append-style: a new package row per build (traceable).

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export async function insertPackage(
  client: PoolClient,
  input: {
    programId: string;
    status: "ready" | "failed";
    storagePath: string | null;
    indexManifest: unknown;
    justification: string | null;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into export_packages
       (program_id, status, storage_path, index_manifest, justification, created_by_actor)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [
      input.programId,
      input.status,
      input.storagePath,
      JSON.stringify(input.indexManifest),
      input.justification,
      input.actor,
    ],
  );
  return rows.rows[0]!.id;
}

export interface PackageRow {
  id: string;
  program_id: string;
  status: string;
  storage_path: string | null;
  index_manifest: unknown;
  justification: string | null;
}

export async function getPackage(id: string): Promise<PackageRow | null> {
  const rows = await getPool().query<PackageRow>(
    `select id, program_id, status, storage_path, index_manifest, justification
       from export_packages where id = $1 and is_deleted = false`,
    [id],
  );
  return rows.rows[0] ?? null;
}
