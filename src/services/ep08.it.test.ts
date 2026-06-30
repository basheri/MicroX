// @vitest-environment node
//
// EP-08 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// analysis produced with cited sources + skills; feasibility rated (weak needs a
// justification); and an APPROVED analysis is the hard precondition for generation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import {
  createMarketAnalysis,
  generateMarketAnalysis,
  approveMarketAnalysis,
  requireApprovedMarketAnalysis,
  getMarketAnalysis,
  hasApprovedAnalysis,
  MarketAnalysisNotApprovedError,
} from "@/services/marketAnalysisService";
import { FeasibilityValidationError } from "@/domain/feasibility";
import type { CompletionResult, LLMProvider } from "@/services/llm/types";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

class JsonProvider implements LLMProvider {
  readonly modelId = "mock/model";
  constructor(private readonly out: string) {}
  async complete(): Promise<CompletionResult> {
    return {
      content: this.out,
      model: this.modelId,
      usage: { tokensIn: 3, tokensOut: 2, costUsd: 0 },
    };
  }
  async testConnection() {
    return { ok: true, message: "ok" };
  }
}

suite("EP-08 — labor-market analysis (integration)", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep08");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  async function newProgram(name: string) {
    return (await createProgram({ name, sectorId, fieldId }, "منى")).id;
  }

  it("creates an analysis with skills + cited sources and a feasibility rating", async () => {
    const programId = await newProgram("برنامج السوق");
    await createMarketAnalysis(
      {
        programId,
        summary: "سوق نشط",
        feasibilityRating: "high",
        skills: [{ skill: "تحليل البيانات", demandLevel: "high" }, { skill: "الأمن السيبراني" }],
        sources: [
          { title: "تقرير الهيئة", url: "https://example.gov.sa/report", reliability: "high" },
        ],
      },
      "منى",
    );
    const market = await getMarketAnalysis(programId);
    expect(market!.analysis.feasibility_rating).toBe("high");
    expect(market!.skills).toHaveLength(2);
    expect(market!.sources).toHaveLength(1);
    expect(market!.sources[0].url).toContain("example.gov.sa");
  });

  it("requires a justification for a weak feasibility rating", async () => {
    const programId = await newProgram("برنامج ضعيف");
    await expect(
      createMarketAnalysis(
        { programId, summary: "أدلة محدودة", feasibilityRating: "low", skills: [], sources: [] },
        "منى",
      ),
    ).rejects.toBeInstanceOf(FeasibilityValidationError);

    // With a justification it succeeds.
    await expect(
      createMarketAnalysis(
        {
          programId,
          summary: "أدلة محدودة",
          feasibilityRating: "low",
          justification: "سوق ناشئ لكن الطلب المستقبلي مرجّح",
          skills: [],
          sources: [],
        },
        "منى",
      ),
    ).resolves.toBeTruthy();
    const fa = await getPool().query(
      "select justification from feasibility_assessments where program_id=$1 and rating='low'",
      [programId],
    );
    expect(fa.rows[0].justification).toMatch(/ناشئ/);
  });

  // THE precondition proof: generation is blocked until the analysis is approved.
  it("blocks generation precondition until the analysis is approved, then unblocks it", async () => {
    const programId = await newProgram("برنامج الاعتماد");

    // No analysis yet -> precondition fails.
    await expect(requireApprovedMarketAnalysis(programId)).rejects.toBeInstanceOf(
      MarketAnalysisNotApprovedError,
    );
    expect(await hasApprovedAnalysis(programId)).toBe(false);

    // Create an analysis — still NOT approved -> precondition still fails.
    const analysisId = await createMarketAnalysis(
      {
        programId,
        summary: "جيد",
        feasibilityRating: "high",
        skills: [{ skill: "x" }],
        sources: [],
      },
      "منى",
    );
    await expect(requireApprovedMarketAnalysis(programId)).rejects.toThrow(/شرط مسبق/);

    // Approve -> precondition passes.
    await approveMarketAnalysis(analysisId, "سارة");
    expect(await hasApprovedAnalysis(programId)).toBe(true);
    await expect(requireApprovedMarketAnalysis(programId)).resolves.toBeUndefined();

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='market_analysis.approve'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("generates a schema-valid analysis via the LLM and persists it (mock provider)", async () => {
    const programId = await newProgram("برنامج التوليد");
    const provider = new JsonProvider(
      JSON.stringify({
        summary: "ملخص مُولّد",
        feasibilityRating: "medium",
        skills: [{ skill: "إدارة المشاريع", demandLevel: "medium" }],
        sources: [{ title: "مصدر", url: "https://example.com" }],
      }),
    );
    const id = await generateMarketAnalysis(programId, "منى", provider);
    expect(id).toBeTruthy();
    const market = await getMarketAnalysis(programId);
    expect(market!.analysis.summary).toBe("ملخص مُولّد");
    expect(market!.skills[0].skill).toBe("إدارة المشاريع");
    // The structured generation was logged.
    const llm = await getPool().query(
      "select count(*)::int n from llm_requests where program_id=$1 and status='success'",
      [programId],
    );
    expect(llm.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("refuses anonymous create/approve (rule 00)", async () => {
    const programId = await newProgram("بدون فاعل");
    await expect(
      createMarketAnalysis(
        { programId, summary: null, feasibilityRating: "high", skills: [], sources: [] },
        "",
      ),
    ).rejects.toThrow(/actor_name is required/);
  });
});
