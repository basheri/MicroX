// Programs repository (EP-02). Demonstrates the EP-02 DoD: CRUD on `programs` with
// attribution + audit (rule 00 / rule 30) and soft delete + restore via the
// deleted_items path. Reads use the `active_programs` view (excludes is_deleted).
//
// Each write runs in a transaction together with its audit_logs insert, so a write
// is never recorded as successful unless it actually committed.

import { randomUUID } from "node:crypto";
import { withAudit } from "@/lib/audit";
import { getPool, withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";

export interface Program {
  id: string;
  name: string;
  sector_id: string;
  field_id: string;
  current_stage: string;
  approval_state: string;
  is_published: boolean;
  is_deleted: boolean;
  created_by_actor: string | null;
  updated_by_actor: string | null;
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
          `insert into programs (id, name, sector_id, field_id, created_by_actor, updated_by_actor)
           values ($1, $2, $3, $4, $5, $5)`,
          [id, input.name, input.sectorId, input.fieldId, actor],
        );
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
