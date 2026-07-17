// Center feedback data layer (EP-18). Feedback files → items → change proposals.
// Active (non-deleted) rows only for items. Proposals carry the before/after preview.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export async function insertFeedbackFile(
  client: PoolClient,
  input: { programId: string; storagePath: string | null; actor: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into center_feedback_files (program_id, storage_path, created_by_actor)
     values ($1,$2,$3) returning id`,
    [input.programId, input.storagePath, input.actor],
  );
  return rows.rows[0]!.id;
}

export async function insertFeedbackItem(
  client: PoolClient,
  input: {
    feedbackFileId: string;
    sectionRef: string | null;
    itemText: string;
    category: string | null;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into center_feedback_items
       (feedback_file_id, section_ref, item_text, category, created_by_actor)
     values ($1,$2,$3,$4,$5) returning id`,
    [input.feedbackFileId, input.sectionRef, input.itemText, input.category, input.actor],
  );
  return rows.rows[0]!.id;
}

export interface FeedbackItemRow {
  id: string;
  feedback_file_id: string;
  program_id: string;
  section_ref: string | null;
  item_text: string | null;
  category: string | null;
  status: string;
  created_by_actor: string | null;
}

export async function getFeedbackItem(itemId: string): Promise<FeedbackItemRow | null> {
  const rows = await getPool().query<FeedbackItemRow>(
    `select i.id, i.feedback_file_id, f.program_id, i.section_ref, i.item_text, i.category,
            i.status, i.created_by_actor
       from center_feedback_items i join center_feedback_files f on f.id = i.feedback_file_id
      where i.id = $1 and i.is_deleted = false`,
    [itemId],
  );
  return rows.rows[0] ?? null;
}

export async function setItemStatus(
  client: PoolClient,
  itemId: string,
  status: string,
): Promise<void> {
  await client.query(
    "update center_feedback_items set status = $2, updated_at = now() where id = $1",
    [itemId, status],
  );
}

export async function softDeleteItem(
  client: PoolClient,
  itemId: string,
  actor: string,
): Promise<void> {
  await client.query(
    `update center_feedback_items
        set is_deleted = true, deleted_at = now(), deleted_by_actor = $2 where id = $1`,
    [itemId, actor],
  );
}

export async function listFeedbackItems(
  programId: string,
  filters: { status?: string; category?: string } = {},
): Promise<FeedbackItemRow[]> {
  const where: string[] = ["f.program_id = $1", "i.is_deleted = false"];
  const params: unknown[] = [programId];
  if (filters.status) {
    params.push(filters.status);
    where.push(`i.status = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`i.category = $${params.length}`);
  }
  const rows = await getPool().query<FeedbackItemRow>(
    `select i.id, i.feedback_file_id, f.program_id, i.section_ref, i.item_text, i.category,
            i.status, i.created_by_actor
       from center_feedback_items i join center_feedback_files f on f.id = i.feedback_file_id
      where ${where.join(" and ")} order by i.created_at desc`,
    params,
  );
  return rows.rows;
}

export async function insertProposal(
  client: PoolClient,
  input: {
    programId: string;
    feedbackItemId: string | null;
    sectionRef: string | null;
    oldText: string | null;
    newText: string | null;
    reason: string | null;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into change_proposals
       (program_id, feedback_item_id, section_ref, old_text, new_text, reason, decision,
        created_by_actor)
     values ($1,$2,$3,$4,$5,$6,'pending',$7) returning id`,
    [
      input.programId,
      input.feedbackItemId,
      input.sectionRef,
      input.oldText,
      input.newText,
      input.reason,
      input.actor,
    ],
  );
  return rows.rows[0]!.id;
}

export interface ProposalRow {
  id: string;
  program_id: string;
  feedback_item_id: string | null;
  section_ref: string | null;
  old_text: string | null;
  new_text: string | null;
  reason: string | null;
  decision: string | null;
  applied_version_no: number | null;
}

export async function getProposal(proposalId: string): Promise<ProposalRow | null> {
  const rows = await getPool().query<ProposalRow>(
    `select id, program_id, feedback_item_id, section_ref, old_text, new_text, reason,
            decision, applied_version_no
       from change_proposals where id = $1`,
    [proposalId],
  );
  return rows.rows[0] ?? null;
}

export async function decideProposal(
  client: PoolClient,
  proposalId: string,
  decision: "applied" | "rejected",
  actor: string,
  appliedVersionNo: number | null,
): Promise<void> {
  await client.query(
    `update change_proposals
        set decision = $2, decided_by_actor = $3, decided_at = now(), applied_version_no = $4
      where id = $1`,
    [proposalId, decision, actor, appliedVersionNo],
  );
}

export async function listProposals(programId: string): Promise<ProposalRow[]> {
  const rows = await getPool().query<ProposalRow>(
    `select id, program_id, feedback_item_id, section_ref, old_text, new_text, reason,
            decision, applied_version_no
       from change_proposals where program_id = $1 order by created_at desc`,
    [programId],
  );
  return rows.rows;
}
