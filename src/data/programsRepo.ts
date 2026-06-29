// Programs repository (EP-02). Demonstrates the EP-02 DoD: CRUD on `programs` with
// attribution + audit (rule 00 / rule 30) and soft delete + restore via the
// deleted_items path. Reads use the `active_programs` view (excludes is_deleted).
//
// Each write runs in a transaction together with its audit_logs insert, so a write
// is never recorded as successful unless it actually committed.

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withAudit } from "@/lib/audit";
import { getPool, withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { DEFAULT_SUB_STATUS } from "@/domain/stages";

export interface Program {
  id: string;
  name: string;
  sector_id: string;
  field_id: string;
  development_path_id: string | null;
  current_stage: string;
  sub_status: string;
  completion_pct: number;
  blocking_errors: number;
  warnings_count: number;
  approval_state: string;
  is_published: boolean;
  is_deleted: boolean;
  created_by_actor: string | null;
  updated_by_actor: string | null;
}

export interface ProgramFilters {
  sectorId?: string;
  fieldId?: string;
  developmentPathId?: string;
  stage?: string;
  approvalState?: string;
  search?: string;
}

export interface NewProgram {
  name: string;
  sectorId: string;
  fieldId: string;
}

export async function createProgram(input: NewProgram, actor: string): Promise<Program> {
  const id = randomUUID();
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.create",
        program_id: id,
        new_value: { name: input.name, sector_id: input.sectorId, field_id: input.fieldId },
      },
      async () => {
        await client.query(
          `insert into programs
             (id, name, sector_id, field_id, current_stage, sub_status, created_by_actor, updated_by_actor)
           values ($1, $2, $3, $4, 'new', $5, $6, $6)`,
          [id, input.name, input.sectorId, input.fieldId, DEFAULT_SUB_STATUS, actor],
        );
        // Record the program's first stage in the append-only history.
        await insertStatusHistory(client, id, "new", DEFAULT_SUB_STATUS, actor);
      },
      sink,
    );
  });
  const program = await getActiveProgram(id);
  if (!program) throw new Error("createProgram: program vanished after insert");
  return program;
}

export async function getActiveProgram(id: string): Promise<Program | null> {
  const rows = await getPool().query<Program>("select * from active_programs where id = $1", [id]);
  return rows.rows[0] ?? null;
}

export async function listActivePrograms(): Promise<Program[]> {
  const rows = await getPool().query<Program>(
    "select * from active_programs order by created_at desc",
  );
  return rows.rows;
}

// Soft delete: flips is_deleted and stores a restorable snapshot in deleted_items.
export async function softDeleteProgram(id: string, actor: string): Promise<void> {
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "program.soft_delete", program_id: id },
      async () => {
        await client.query("select app.soft_delete($1, $2, $3)", ["programs", id, actor]);
      },
      sink,
    );
  });
}

// Restore a soft-deleted program from its deleted_items entry. Returns the program id.
export async function restoreProgram(deletedItemId: string, actor: string): Promise<string> {
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    const lookup = await client.query<{ entity_id: string }>(
      "select entity_id from deleted_items where id = $1",
      [deletedItemId],
    );
    const programId = lookup.rows[0]?.entity_id ?? null;
    await withAudit(
      { actor_name: actor, operation_type: "program.restore", program_id: programId },
      async () => {
        await client.query("select app.restore($1, $2)", [deletedItemId, actor]);
      },
      sink,
    );
    if (!programId) throw new Error("restoreProgram: deleted_item not found");
    return programId;
  });
}

// ---------- EP-03: stage machine, history, metrics, dashboard ----------

// Update the program's current stage + sub_status (within a caller transaction).
export async function updateProgramStage(
  client: PoolClient,
  programId: string,
  stage: string,
  subStatus: string,
  actor: string,
): Promise<void> {
  await client.query(
    `update programs set current_stage = $2, sub_status = $3,
       updated_by_actor = $4, updated_at = now() where id = $1`,
    [programId, stage, subStatus, actor],
  );
}

// Append a row to program_status_history (append-only audit of stage transitions).
export async function insertStatusHistory(
  client: PoolClient,
  programId: string,
  stage: string,
  subStatus: string,
  actor: string,
): Promise<void> {
  await client.query(
    `insert into program_status_history (program_id, stage, sub_status, changed_by_actor)
     values ($1, $2, $3, $4)`,
    [programId, stage, subStatus, actor],
  );
}

export interface StatusHistoryRow {
  stage: string;
  sub_status: string | null;
  changed_by_actor: string | null;
  changed_at: string;
}

export async function getStatusHistory(programId: string): Promise<StatusHistoryRow[]> {
  const rows = await getPool().query<StatusHistoryRow>(
    `select stage, sub_status, changed_by_actor, changed_at
       from program_status_history where program_id = $1 order by changed_at asc`,
    [programId],
  );
  return rows.rows;
}

// Persist the computed dashboard metrics on the program row.
export async function updateProgramMetrics(
  programId: string,
  metrics: { completionPct: number; blockingErrors: number; warningsCount: number },
): Promise<void> {
  await getPool().query(
    `update programs set completion_pct = $2, blocking_errors = $3, warnings_count = $4,
       updated_at = now() where id = $1`,
    [programId, metrics.completionPct, metrics.blockingErrors, metrics.warningsCount],
  );
}

// Course count + total credit hours for a program (active courses only) — feeds
// the BR-001 / BR-002 structural checks.
export async function getProgramCourseStats(
  programId: string,
): Promise<{ courseCount: number; totalCreditHours: number }> {
  const rows = await getPool().query<{ course_count: string; total_credits: string | null }>(
    `select count(*)::int as course_count, coalesce(sum(credit_hours), 0) as total_credits
       from courses where program_id = $1 and is_deleted = false`,
    [programId],
  );
  const row = rows.rows[0]!;
  return { courseCount: Number(row.course_count), totalCreditHours: Number(row.total_credits) };
}

// Dashboard listing over active_programs with optional filters + name search.
export async function listPrograms(filters: ProgramFilters = {}): Promise<Program[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };

  if (filters.sectorId) add("sector_id = ?", filters.sectorId);
  if (filters.fieldId) add("field_id = ?", filters.fieldId);
  if (filters.developmentPathId) add("development_path_id = ?", filters.developmentPathId);
  if (filters.stage) add("current_stage = ?", filters.stage);
  if (filters.approvalState) add("approval_state = ?", filters.approvalState);
  if (filters.search && filters.search.trim())
    add("name ilike '%' || ? || '%'", filters.search.trim());

  const sql =
    "select * from active_programs" +
    (where.length ? ` where ${where.join(" and ")}` : "") +
    " order by created_at desc";
  const rows = await getPool().query<Program>(sql, params as never[]);
  return rows.rows;
}
