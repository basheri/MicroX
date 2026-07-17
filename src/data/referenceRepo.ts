// References data layer (EP-14): program_references. Active rows only.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export interface ReferenceRow {
  id: string;
  program_id: string;
  citation: string;
  language: string | null;
  ref_type: string | null;
  verified: boolean;
  verification_note: string | null;
}

export async function insertReference(
  client: PoolClient,
  input: { programId: string; citation: string; language?: string | null; refType?: string | null },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into program_references (program_id, citation, language, ref_type, verified)
     values ($1, $2, $3, $4, false) returning id`,
    [input.programId, input.citation, input.language ?? null, input.refType ?? null],
  );
  return rows.rows[0]!.id;
}

export async function setVerification(
  client: PoolClient,
  refId: string,
  verified: boolean,
  note: string,
): Promise<void> {
  await client.query(
    "update program_references set verified = $2, verification_note = $3 where id = $1",
    [refId, verified, note],
  );
}

export async function getReference(refId: string): Promise<ReferenceRow | null> {
  const rows = await getPool().query<ReferenceRow>(
    "select id, program_id, citation, language, ref_type, verified, verification_note from program_references where id = $1 and is_deleted = false",
    [refId],
  );
  return rows.rows[0] ?? null;
}

export async function listReferences(
  programId: string,
  filters: { language?: string; verified?: boolean } = {},
): Promise<ReferenceRow[]> {
  const where: string[] = ["program_id = $1", "is_deleted = false"];
  const params: unknown[] = [programId];
  if (filters.language) {
    params.push(filters.language);
    where.push(`language = $${params.length}`);
  }
  if (filters.verified !== undefined) {
    params.push(filters.verified);
    where.push(`verified = $${params.length}`);
  }
  const rows = await getPool().query<ReferenceRow>(
    `select id, program_id, citation, language, ref_type, verified, verification_note
       from program_references where ${where.join(" and ")} order by language, id`,
    params,
  );
  return rows.rows;
}

export async function listUnverifiedIds(programId: string): Promise<string[]> {
  const rows = await getPool().query<{ id: string }>(
    "select id from program_references where program_id = $1 and is_deleted = false and verified = false",
    [programId],
  );
  return rows.rows.map((r) => r.id);
}
