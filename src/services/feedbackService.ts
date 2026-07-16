// Center feedback service (EP-18). Reviewer feedback → items → change proposals →
// preview-before-apply. A proposal is the PREVIEW (before/after); applying it is a
// SEPARATE explicit step that creates a program version (D-06) and is audited. Nothing
// mutates content silently; every write is attributed (rule 00).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import { createVersionInTx } from "@/services/versioningService";
import {
  insertFeedbackFile,
  insertFeedbackItem,
  getFeedbackItem,
  setItemStatus,
  softDeleteItem,
  listFeedbackItems,
  insertProposal,
  getProposal,
  decideProposal,
  listProposals,
  type FeedbackItemRow,
  type ProposalRow,
} from "@/data/feedbackRepo";

function requireActor(actor: string) {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
}

export async function ingestFeedbackFile(
  programId: string,
  input: { storagePath?: string | null },
  actor: string,
): Promise<string> {
  requireActor(actor);
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("ingestFeedbackFile: program not found");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let fileId = "";
    await withAudit(
      { actor_name: actor, operation_type: "feedback.file.ingest", program_id: programId },
      async () => {
        fileId = await insertFeedbackFile(client, {
          programId,
          storagePath: input.storagePath ?? null,
          actor,
        });
      },
      sink,
    );
    return fileId;
  });
}

export async function addFeedbackItem(
  feedbackFileId: string,
  input: { sectionRef?: string | null; itemText: string; category?: string | null },
  actor: string,
): Promise<string> {
  requireActor(actor);
  if (!input.itemText?.trim()) throw new Error("نص الملاحظة مطلوب.");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let itemId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "feedback.item.add",
        section_ref: input.sectionRef ?? null,
        new_value: { itemText: input.itemText },
      },
      async () => {
        itemId = await insertFeedbackItem(client, {
          feedbackFileId,
          sectionRef: input.sectionRef ?? null,
          itemText: input.itemText,
          category: input.category ?? null,
          actor,
        });
      },
      sink,
    );
    return itemId;
  });
}

// Create a PREVIEW proposal (before/after). Does NOT mutate anything or create a
// version — it must be applied explicitly.
export async function proposeChange(
  programId: string,
  input: {
    feedbackItemId?: string | null;
    sectionRef?: string | null;
    oldText?: string | null;
    newText: string;
    reason?: string | null;
  },
  actor: string,
): Promise<string> {
  requireActor(actor);
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("proposeChange: program not found");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let proposalId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "feedback.proposal.create",
        program_id: programId,
        section_ref: input.sectionRef ?? null,
        old_value: { oldText: input.oldText ?? null },
        new_value: { newText: input.newText },
      },
      async () => {
        proposalId = await insertProposal(client, {
          programId,
          feedbackItemId: input.feedbackItemId ?? null,
          sectionRef: input.sectionRef ?? null,
          oldText: input.oldText ?? null,
          newText: input.newText,
          reason: input.reason ?? null,
          actor,
        });
      },
      sink,
    );
    return proposalId;
  });
}

export class ProposalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalStateError";
  }
}

export interface ApplyResult {
  proposalId: string;
  appliedVersionNo: number;
}

// Apply an APPROVED proposal: only from 'pending', creates a program version (D-06),
// marks the proposal applied, and resolves the linked feedback item. This is the only
// path that changes state — preview-before-apply is enforced by construction.
export async function applyProposal(proposalId: string, actor: string): Promise<ApplyResult> {
  requireActor(actor);
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("applyProposal: proposal not found");
  if (proposal.decision !== "pending") {
    throw new ProposalStateError(
      `لا يمكن تطبيق مقترح حالته «${proposal.decision}» (يجب أن يكون قيد الانتظار).`,
    );
  }
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let versionNo = 0;
    await withAudit(
      {
        actor_name: actor,
        operation_type: "feedback.proposal.apply",
        program_id: proposal.program_id,
        section_ref: proposal.section_ref,
        old_value: { oldText: proposal.old_text },
        new_value: { newText: proposal.new_text },
        change_reason: proposal.reason,
      },
      async () => {
        // Each apply creates a version (DoD).
        versionNo = await createVersionInTx(client, proposal.program_id, "feedback.apply", actor);
        await decideProposal(client, proposalId, "applied", actor, versionNo);
        if (proposal.feedback_item_id) {
          await setItemStatus(client, proposal.feedback_item_id, "resolved");
        }
      },
      sink,
    );
    return { proposalId, appliedVersionNo: versionNo };
  });
}

export async function rejectProposal(
  proposalId: string,
  actor: string,
  reason?: string,
): Promise<void> {
  requireActor(actor);
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("rejectProposal: proposal not found");
  if (proposal.decision !== "pending") {
    throw new ProposalStateError("لا يمكن رفض مقترح غير معلّق.");
  }
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "feedback.proposal.reject",
        program_id: proposal.program_id,
        change_reason: reason ?? null,
      },
      async () => {
        await decideProposal(client, proposalId, "rejected", actor, null);
      },
      sink,
    );
  });
}

export async function setFeedbackItemStatus(
  itemId: string,
  status: "new" | "in_progress" | "resolved" | "needs_clarification",
  actor: string,
): Promise<void> {
  requireActor(actor);
  const item = await getFeedbackItem(itemId);
  if (!item) throw new Error("setFeedbackItemStatus: item not found");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "feedback.item.status",
        program_id: item.program_id,
        old_value: { status: item.status },
        new_value: { status },
      },
      async () => {
        await setItemStatus(client, itemId, status);
      },
      sink,
    );
  });
}

export async function deleteFeedbackItem(itemId: string, actor: string): Promise<void> {
  requireActor(actor);
  const item = await getFeedbackItem(itemId);
  if (!item) throw new Error("deleteFeedbackItem: item not found");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "feedback.item.delete", program_id: item.program_id },
      async () => {
        await softDeleteItem(client, itemId, actor);
      },
      sink,
    );
  });
}

export function getFeedbackItems(
  programId: string,
  filters?: { status?: string; category?: string },
): Promise<FeedbackItemRow[]> {
  return listFeedbackItems(programId, filters);
}

export function getProposals(programId: string): Promise<ProposalRow[]> {
  return listProposals(programId);
}

export { getFeedbackItem, getProposal };
