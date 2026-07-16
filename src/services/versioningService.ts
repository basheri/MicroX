// Versioning service (D-06). Writes a full JSONB program snapshot on every meaningful
// change, attributed + audited. EP-18 uses createProgramVersion on feedback apply;
// EP-19 layers publish/lock/restore on top.

import type { PoolClient } from "pg";
import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import {
  nextVersionNo,
  buildProgramSnapshot,
  insertVersion,
  listVersions,
  getVersionSnapshot,
  type VersionRow,
} from "@/data/versionRepo";

// Create a version within an EXISTING transaction (so the snapshot is consistent with
// the change that triggered it). Returns the new version number.
export async function createVersionInTx(
  client: PoolClient,
  programId: string,
  triggerEvent: string,
  actor: string,
): Promise<number> {
  const versionNo = await nextVersionNo(client, programId);
  const snapshot = await buildProgramSnapshot(client, programId);
  await insertVersion(client, { programId, versionNo, snapshot, triggerEvent, actor });
  return versionNo;
}

// Standalone: snapshot the current program state as a new version (its own transaction).
export async function createProgramVersion(
  programId: string,
  triggerEvent: string,
  actor: string,
): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let versionNo = 0;
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.version.create",
        program_id: programId,
        new_value: { triggerEvent },
      },
      async () => {
        versionNo = await createVersionInTx(client, programId, triggerEvent, actor);
      },
      sink,
    );
    return versionNo;
  });
}

export function getProgramVersions(programId: string): Promise<VersionRow[]> {
  return listVersions(programId);
}

export { getVersionSnapshot };
