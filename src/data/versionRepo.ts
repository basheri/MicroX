// Versioning data layer (D-06). Full JSONB program snapshots in program_versions
// with an incrementing version_no and a trigger_event. Used by EP-18 (feedback apply
// creates a version) and EP-19 (publish/lock/restore).

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export async function nextVersionNo(client: PoolClient, programId: string): Promise<number> {
  const rows = await client.query<{ n: number }>(
    "select coalesce(max(version_no), 0) + 1 as n from program_versions where program_id = $1",
    [programId],
  );
  return rows.rows[0]!.n;
}

// Assemble a full snapshot of the program's core content (D-06). Read within the
// caller's transaction so it is consistent with the change being versioned.
export async function buildProgramSnapshot(
  client: PoolClient,
  programId: string,
): Promise<Record<string, unknown>> {
  const one = async (sql: string) => (await client.query(sql, [programId])).rows;
  const program = (await client.query("select * from programs where id = $1", [programId])).rows[0];
  const courses = await one(
    "select * from courses where program_id = $1 and is_deleted = false order by created_at",
  );
  const plos = await one(
    "select * from program_learning_outcomes where program_id = $1 and is_deleted = false order by order_index",
  );
  const clos = (
    await client.query(
      `select c.* from course_learning_outcomes c join courses co on co.id = c.course_id
        where co.program_id = $1 and c.is_deleted = false`,
      [programId],
    )
  ).rows;
  const units = (
    await client.query(
      `select u.* from course_units u join courses co on co.id = u.course_id
        where co.program_id = $1 and u.is_deleted = false`,
      [programId],
    )
  ).rows;
  const references = await one(
    "select * from program_references where program_id = $1 and is_deleted = false",
  );
  return { program, courses, plos, clos, units, references };
}

export async function insertVersion(
  client: PoolClient,
  input: {
    programId: string;
    versionNo: number;
    snapshot: Record<string, unknown>;
    triggerEvent: string;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into program_versions (program_id, version_no, snapshot, trigger_event, created_by_actor)
     values ($1,$2,$3,$4,$5) returning id`,
    [
      input.programId,
      input.versionNo,
      JSON.stringify(input.snapshot),
      input.triggerEvent,
      input.actor,
    ],
  );
  return rows.rows[0]!.id;
}

export interface VersionRow {
  id: string;
  version_no: number;
  trigger_event: string;
  created_by_actor: string | null;
  created_at: string;
}

export async function listVersions(programId: string): Promise<VersionRow[]> {
  const rows = await getPool().query<VersionRow>(
    `select id, version_no, trigger_event, created_by_actor, created_at
       from program_versions where program_id = $1 order by version_no desc`,
    [programId],
  );
  return rows.rows;
}

export async function getVersionSnapshot(
  programId: string,
  versionNo: number,
): Promise<Record<string, unknown> | null> {
  const rows = await getPool().query<{ snapshot: Record<string, unknown> }>(
    "select snapshot from program_versions where program_id = $1 and version_no = $2",
    [programId, versionNo],
  );
  return rows.rows[0]?.snapshot ?? null;
}
