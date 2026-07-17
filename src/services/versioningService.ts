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
import {
  getPublishState,
  setPublished,
  bumpVersionNo,
  getActiveProgram,
} from "@/data/programsRepo";

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

// Thrown when a mutation targets a PUBLISHED (locked) program (BR-020 / TC-13).
export class PublishedLockError extends Error {
  constructor(programId: string) {
    super(
      `النسخة منشورة ومقفلة (القاعدة BR-020). افتح دورة تحديث جديدة قبل التعديل. (${programId})`,
    );
    this.name = "PublishedLockError";
  }
}

// Guard used by mutating services: a published program is immutable until an update
// cycle is opened. Call at the top of any content mutation.
export async function assertEditable(programId: string): Promise<void> {
  const state = await getPublishState(programId);
  if (state?.isPublished) throw new PublishedLockError(programId);
}

// Publish a program: snapshot it as an immutable 'publish' version and lock it (BR-020).
export async function publishProgram(programId: string, actor: string): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("publishProgram: program not found");
  if (program.is_published) throw new PublishedLockError(programId);
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let versionNo = 0;
    await withAudit(
      { actor_name: actor, operation_type: "program.publish", program_id: programId },
      async () => {
        versionNo = await createVersionInTx(client, programId, "publish", actor);
        await bumpVersionNo(client, programId, versionNo, actor);
        await setPublished(client, programId, true, actor);
      },
      sink,
    );
    return versionNo;
  });
}

// Open a new update cycle on a published program (BR-020): retains the published
// snapshot, unlocks the program for editing, and records the cycle opening as a version.
export async function openUpdateCycle(programId: string, actor: string): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const state = await getPublishState(programId);
  if (!state) throw new Error("openUpdateCycle: program not found");
  if (!state.isPublished) throw new Error("openUpdateCycle: program is not published.");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let versionNo = 0;
    await withAudit(
      { actor_name: actor, operation_type: "program.update_cycle.open", program_id: programId },
      async () => {
        versionNo = await createVersionInTx(client, programId, "update_cycle_open", actor);
        await bumpVersionNo(client, programId, versionNo, actor);
        await setPublished(client, programId, false, actor); // unlock for the new cycle
      },
      sink,
    );
    return versionNo;
  });
}

// Restore a prior version: NEVER overwrites history — creates a NEW version whose
// snapshot equals the restored one, with trigger 'restore' (TC-14 / §versioning).
export async function restoreVersion(
  programId: string,
  versionNo: number,
  actor: string,
): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const snapshot = await getVersionSnapshot(programId, versionNo);
  if (!snapshot) throw new Error("restoreVersion: version not found");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let newVersionNo = 0;
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.version.restore",
        program_id: programId,
        old_value: { restoredFrom: versionNo },
      },
      async () => {
        newVersionNo = await nextVersionNo(client, programId);
        await insertVersion(client, {
          programId,
          versionNo: newVersionNo,
          snapshot: { ...snapshot, restoredFrom: versionNo },
          triggerEvent: "restore",
          actor,
        });
        await bumpVersionNo(client, programId, newVersionNo, actor);
      },
      sink,
    );
    return newVersionNo;
  });
}

// Shallow compare of two versions' snapshots: which top-level sections differ, plus
// row-count deltas for the array sections (courses/plos/clos/units/references).
export async function compareVersions(
  programId: string,
  versionA: number,
  versionB: number,
): Promise<{ changedSections: string[]; countDeltas: Record<string, number> }> {
  const [a, b] = await Promise.all([
    getVersionSnapshot(programId, versionA),
    getVersionSnapshot(programId, versionB),
  ]);
  if (!a || !b) throw new Error("compareVersions: version not found");
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changedSections: string[] = [];
  const countDeltas: Record<string, number> = {};
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changedSections.push(k);
    if (Array.isArray(a[k]) || Array.isArray(b[k])) {
      const na = Array.isArray(a[k]) ? (a[k] as unknown[]).length : 0;
      const nb = Array.isArray(b[k]) ? (b[k] as unknown[]).length : 0;
      if (na !== nb) countDeltas[k] = nb - na;
    }
  }
  return { changedSections, countDeltas };
}

export { getVersionSnapshot };
