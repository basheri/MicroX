// @vitest-environment node
//
// EP-18 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the
// center-feedback workflow: ingest → item → PREVIEW proposal → apply-after-approval,
// where apply creates a program version (D-06) and nothing mutates before approval.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import {
  ingestFeedbackFile,
  addFeedbackItem,
  proposeChange,
  applyProposal,
  rejectProposal,
  setFeedbackItemStatus,
  deleteFeedbackItem,
  getProposal,
  getFeedbackItem,
  getFeedbackItems,
  ProposalStateError,
} from "@/services/feedbackService";
import { getProgramVersions } from "@/services/versioningService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-18 — center feedback (integration)", () => {
  let db: IsolatedDb;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep18");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (await createProgram({ name: "برنامج المراجعة", sectorId, fieldId }, "منى")).id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("ingests a feedback file and item, attributed to the actor", async () => {
    const fileId = await ingestFeedbackFile(programId, { storagePath: "feedback/f1.pdf" }, "منى");
    const itemId = await addFeedbackItem(
      fileId,
      { sectionRef: "outcomes", itemText: "صياغة المخرج غير واضحة", category: "clarity" },
      "منى",
    );
    const item = await getFeedbackItem(itemId);
    expect(item?.created_by_actor).toBe("منى");
    expect(item?.status).toBe("new");
  });

  it("a PREVIEW proposal does not mutate or create a version until applied", async () => {
    const beforeVersions = (await getProgramVersions(programId)).length;
    const proposalId = await proposeChange(
      programId,
      { sectionRef: "outcomes", oldText: "قديم", newText: "جديد واضح", reason: "ملاحظة المركز" },
      "منى",
    );
    const p = await getProposal(proposalId);
    expect(p?.decision).toBe("pending");
    // No version created by merely proposing (preview-before-apply).
    expect((await getProgramVersions(programId)).length).toBe(beforeVersions);
  });

  it("applying an approved proposal creates a version and resolves the linked item", async () => {
    const fileId = await ingestFeedbackFile(programId, {}, "منى");
    const itemId = await addFeedbackItem(fileId, { itemText: "تعديل مطلوب" }, "منى");
    const proposalId = await proposeChange(
      programId,
      { feedbackItemId: itemId, sectionRef: "s1", oldText: "أ", newText: "ب", reason: "سبب" },
      "منى",
    );

    const before = (await getProgramVersions(programId)).length;
    const result = await applyProposal(proposalId, "منى");
    const after = await getProgramVersions(programId);

    // Each apply creates exactly one new version (DoD).
    expect(after.length).toBe(before + 1);
    expect(result.appliedVersionNo).toBe(after[0]!.version_no);
    expect(after[0]!.trigger_event).toBe("feedback.apply");

    // Proposal marked applied + item resolved.
    expect((await getProposal(proposalId))?.decision).toBe("applied");
    expect((await getFeedbackItem(itemId))?.status).toBe("resolved");

    // Audited.
    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where program_id=$1 and operation_type='feedback.proposal.apply'",
      [programId],
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("a proposal cannot be applied twice (state guard)", async () => {
    const proposalId = await proposeChange(programId, { newText: "مرة واحدة" }, "منى");
    await applyProposal(proposalId, "منى");
    await expect(applyProposal(proposalId, "منى")).rejects.toBeInstanceOf(ProposalStateError);
  });

  it("rejecting a proposal blocks a later apply and creates no version", async () => {
    const proposalId = await proposeChange(programId, { newText: "سيُرفض" }, "منى");
    const before = (await getProgramVersions(programId)).length;
    await rejectProposal(proposalId, "منى", "غير مناسب");
    expect((await getProposal(proposalId))?.decision).toBe("rejected");
    await expect(applyProposal(proposalId, "منى")).rejects.toBeInstanceOf(ProposalStateError);
    expect((await getProgramVersions(programId)).length).toBe(before);
  });

  it("supports status changes and soft delete; deleted items drop from the active list", async () => {
    const fileId = await ingestFeedbackFile(programId, {}, "منى");
    const itemId = await addFeedbackItem(fileId, { itemText: "للحذف" }, "منى");
    await setFeedbackItemStatus(itemId, "in_progress", "منى");
    expect((await getFeedbackItem(itemId))?.status).toBe("in_progress");

    await deleteFeedbackItem(itemId, "منى");
    const active = await getFeedbackItems(programId);
    expect(active.find((i) => i.id === itemId)).toBeUndefined();
  });

  it("refuses anonymous feedback operations (rule 00)", async () => {
    await expect(ingestFeedbackFile(programId, {}, "")).rejects.toThrow(/actor_name is required/);
    await expect(proposeChange(programId, { newText: "x" }, "")).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
