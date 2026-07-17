// @vitest-environment node
//
// EP-09 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves:
// (a) impact analysis applies nothing on its own;
// (b) no generated section is written/applied without an explicit preview->apply step;
// (c) a running job reports progress and can be cancelled.
// Plus the EP-08 precondition and section pinning. No live OpenRouter calls.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { createMarketAnalysis, approveMarketAnalysis } from "@/services/marketAnalysisService";
import { MarketAnalysisNotApprovedError } from "@/services/marketAnalysisService";
import {
  startGeneration,
  runGenerationJob,
  cancelGenerationJob,
  impactAnalysis,
  applyGeneratedSection,
  pinGeneratedSection,
  getGenerationState,
  getJob,
} from "@/services/generationService";
import { countApplied } from "@/data/generationRepo";
import type { CompletionResult, LLMProvider } from "@/services/llm/types";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

// Provider returning {"content": base+N}; optional hook fires inside complete() (used to
// cancel mid-run).
class HookProvider implements LLMProvider {
  readonly modelId = "mock/model";
  calls = 0;
  constructor(
    private readonly base: string,
    private readonly hook?: (calls: number) => Promise<void>,
  ) {}
  async complete(): Promise<CompletionResult> {
    this.calls += 1;
    if (this.hook) await this.hook(this.calls);
    return {
      content: JSON.stringify({ content: `${this.base}${this.calls}` }),
      model: this.modelId,
      usage: { tokensIn: 1, tokensOut: 1, costUsd: 0 },
    };
  }
  async testConnection() {
    return { ok: true, message: "ok" };
  }
}

suite("EP-09 — program generator (integration)", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep09");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  async function programWithApprovedMarket(name: string): Promise<string> {
    const id = (await createProgram({ name, sectorId, fieldId }, "منى")).id;
    const analysisId = await createMarketAnalysis(
      {
        programId: id,
        summary: "ok",
        feasibilityRating: "high",
        skills: [{ skill: "x" }],
        sources: [],
      },
      "منى",
    );
    await approveMarketAnalysis(analysisId, "منى");
    return id;
  }

  it("requires an approved market analysis before generation (EP-08 precondition)", async () => {
    const id = (await createProgram({ name: "بلا اعتماد", sectorId, fieldId }, "منى")).id;
    await expect(startGeneration(id, {}, "منى")).rejects.toBeInstanceOf(
      MarketAnalysisNotApprovedError,
    );

    const analysisId = await createMarketAnalysis(
      { programId: id, summary: "ok", feasibilityRating: "high", skills: [], sources: [] },
      "منى",
    );
    await approveMarketAnalysis(analysisId, "منى");
    await expect(startGeneration(id, {}, "منى")).resolves.toBeTruthy();
  });

  // (b) preview-before-apply: generation writes PREVIEWS only; nothing is 'applied'
  // until an explicit apply step.
  it("(b) generated sections are previews; none are applied without an explicit apply", async () => {
    const programId = await programWithApprovedMarket("معاينة");
    const jobId = await startGeneration(programId, {}, "منى");
    await runGenerationJob(jobId, "منى", new HookProvider("v"));

    const { sections } = await getGenerationState(programId);
    expect(sections.length).toBe(6);
    expect(sections.every((s) => s.status === "previewed")).toBe(true);
    expect(await countApplied(programId)).toBe(0); // NOTHING applied by generation

    const job = await getJob(jobId);
    expect(job!.status).toBe("done");
    expect(job!.progress).toBe(100);

    // Explicit apply after preview -> exactly that one becomes applied.
    await applyGeneratedSection(sections[0]!.id, "سارة");
    expect(await countApplied(programId)).toBe(1);
    const after = await getGenerationState(programId);
    expect(after.sections.filter((s) => s.status === "applied")).toHaveLength(1);
  });

  // (a) impact analysis lists affected sections and changes NOTHING.
  it("(a) impact analysis applies nothing", async () => {
    const programId = await programWithApprovedMarket("أثر");
    const jobId = await startGeneration(programId, {}, "منى");
    await runGenerationJob(jobId, "منى", new HookProvider("v"));

    const before = JSON.stringify((await getGenerationState(programId)).sections);
    const appliedBefore = await countApplied(programId);

    const report = await impactAnalysis(programId, "outcomes");
    expect(report.applied).toBe(false);
    expect(report.affectedKeys).toEqual(
      expect.arrayContaining(["outcomes", "courses", "questions"]),
    );
    expect(report.affectedExisting.length).toBeGreaterThan(0);

    // State is byte-for-byte unchanged.
    expect(JSON.stringify((await getGenerationState(programId)).sections)).toBe(before);
    expect(await countApplied(programId)).toBe(appliedBefore);
  });

  // (c) a running job reports progress and can be cancelled mid-run.
  it("(c) a job reports progress and stops when cancelled", async () => {
    const programId = await programWithApprovedMarket("إلغاء");
    const jobId = await startGeneration(programId, {}, "منى");
    // Cancel the job during the first section's generation.
    const provider = new HookProvider("v", async (calls) => {
      if (calls === 1) await cancelGenerationJob(jobId, "منى");
    });
    await runGenerationJob(jobId, "منى", provider);

    const job = await getJob(jobId);
    expect(job!.status).toBe("cancelled");
    expect(job!.progress).toBeGreaterThan(0); // progress was reported
    expect(job!.progress).toBeLessThan(100); // did not finish
    // It stopped early — far fewer than all 6 sections were generated.
    const { sections } = await getGenerationState(programId);
    expect(sections.length).toBeLessThan(6);
  });

  it("regeneration skips pinned sections (leaves them untouched)", async () => {
    const programId = await programWithApprovedMarket("تثبيت");
    const jobId = await startGeneration(programId, {}, "منى");
    await runGenerationJob(jobId, "منى", new HookProvider("orig"));

    const state = await getGenerationState(programId);
    const pinned = state.sections.find((s) => s.section_key === "outcomes")!;
    const unpinned = state.sections.find((s) => s.section_key === "courses")!;
    await pinGeneratedSection(pinned.id, true, "منى");

    const job2 = await startGeneration(programId, {}, "منى");
    await runGenerationJob(job2, "منى", new HookProvider("NEW"), { skipPinned: true });

    const after = await getGenerationState(programId);
    const pinnedAfter = after.sections.find((s) => s.id === pinned.id)!;
    const unpinnedAfter = after.sections.find((s) => s.id === unpinned.id)!;
    // Pinned content unchanged; unpinned regenerated with new content.
    expect(JSON.stringify(pinnedAfter.content)).toBe(JSON.stringify(pinned.content));
    expect(JSON.stringify(unpinnedAfter.content)).not.toBe(JSON.stringify(unpinned.content));
    expect(JSON.stringify(unpinnedAfter.content)).toContain("NEW");
  });

  it("refuses anonymous generation actions (rule 00)", async () => {
    const programId = await programWithApprovedMarket("بدون فاعل");
    await expect(startGeneration(programId, {}, "")).rejects.toThrow(/actor_name is required/);
  });
});
