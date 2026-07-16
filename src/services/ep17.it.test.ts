// @vitest-environment node
//
// EP-17 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the
// six-axis quality engine end-to-end: high vs low vs empty programs, an LLM-assisted
// axis with confidence via the LLMProvider abstraction (mock), persistence + audit,
// and the invariant that quality NEVER blocks export (regression against BR-019).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import { assessProgramQuality, getProgramQuality } from "@/services/qualityService";
import {
  seedComplianceRules,
  attemptExport,
  JustificationRequiredError,
} from "@/services/complianceService";
import { MockLLMProvider } from "@/services/llm/mockProvider";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

// A scripted mock that returns a schema-valid clarity result with a set confidence.
function clarityProvider(score: number, confidence: "low" | "medium" | "high") {
  return new MockLLMProvider(
    "mock/model",
    JSON.stringify({ score, confidence, rationale: "تقييم لغوي تجريبي." }),
  );
}

// Build the full academic chain for a program directly (deterministic + fast).
async function seedAcademicChain(programId: string, covered: boolean) {
  const pool = getPool();
  const courseId = (await addCourse(programId, { title: "مقرر", creditHours: 3 }, "منى")) as string;
  const plo = (
    await pool.query(
      "insert into program_learning_outcomes (program_id, statement) values ($1,'مخرج برنامج واضح') returning id",
      [programId],
    )
  ).rows[0].id;
  const clo = (
    await pool.query(
      "insert into course_learning_outcomes (course_id, statement) values ($1,'مخرج مقرر') returning id",
      [courseId],
    )
  ).rows[0].id;
  const unit = (
    await pool.query(
      "insert into course_units (course_id, title, order_index) values ($1,'وحدة',1) returning id",
      [courseId],
    )
  ).rows[0].id;
  const bank = (
    await pool.query(
      "insert into question_banks (program_id, title) values ($1,'بنك') returning id",
      [programId],
    )
  ).rows[0].id;
  await pool.query(
    `insert into questions (question_bank_id, clo_id, stem, qtype) values ($1,$2,'سؤال','mcq')`,
    [bank, covered ? clo : null],
  );
  await pool.query(
    "insert into program_references (program_id, citation, language, verified) values ($1,'مرجع','ar',$2)",
    [programId, covered],
  );
  if (covered) {
    // Cover PLO, CLO, and the unit via the alignment matrix.
    await pool.query("insert into alignment_matrix (program_id, plo_id) values ($1,$2)", [
      programId,
      plo,
    ]);
    await pool.query(
      "insert into alignment_matrix (program_id, clo_id, unit_id) values ($1,$2,$3)",
      [programId, clo, unit],
    );
  }
}

suite("EP-17 — quality engine (integration)", () => {
  let db: IsolatedDb;
  let highProgram: string;
  let lowProgram: string;
  let emptyProgram: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep17");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    await seedComplianceRules("منى");

    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;

    highProgram = (await createProgram({ name: "برنامج عالي الجودة", sectorId, fieldId }, "منى"))
      .id;
    await addCourse(highProgram, { title: "مقرر آخر", creditHours: 3 }, "منى"); // 2 courses -> BR-001 ok
    await seedAcademicChain(highProgram, true);

    lowProgram = (await createProgram({ name: "برنامج منخفض الجودة", sectorId, fieldId }, "منى"))
      .id;
    await addCourse(lowProgram, { title: "مقرر آخر", creditHours: 3 }, "منى");
    await seedAcademicChain(lowProgram, false);

    emptyProgram = (await createProgram({ name: "برنامج فارغ", sectorId, fieldId }, "منى")).id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("scores a complete program high, with a confidence-scored LLM axis, and persists it", async () => {
    const r = await assessProgramQuality(highProgram, "منى", {
      provider: clarityProvider(90, "high"),
    });
    expect(r.overall).toBeGreaterThanOrEqual(90);
    expect(r.blocksExport).toBe(false);
    const clarity = r.axes.find((a) => a.key === "outcome_clarity")!;
    expect(clarity.confidence).toBe("high");

    // Persisted: per-axis rows + an overall row for the latest run.
    const stored = await getProgramQuality(highProgram);
    expect(stored.some((s) => s.axis === "overall")).toBe(true);
    expect(stored.length).toBeGreaterThanOrEqual(7);

    // Audited with the model logged (AI-007).
    const audit = await getPool().query(
      "select llm_model from audit_logs where program_id=$1 and operation_type='quality.assess' order by occurred_at desc limit 1",
      [highProgram],
    );
    expect(audit.rows[0].llm_model).toBe("mock/model");
  });

  it("scores an unaligned program low and raises warnings (traceable evidence)", async () => {
    const r = await assessProgramQuality(lowProgram, "منى", {
      provider: clarityProvider(40, "low"),
    });
    expect(r.overall).toBeLessThan(70);
    expect(r.warnings.length).toBeGreaterThan(0);
    const plo = r.axes.find((a) => a.key === "plo_coverage")!;
    expect(plo.isWarning).toBe(true);
    expect(plo.evidence.join(" ")).toMatch(/غير مغطّى/);
  });

  it("handles an empty program with explicit insufficient-data axes (no fake pass)", async () => {
    const r = await assessProgramQuality(emptyProgram, "منى");
    const plo = r.axes.find((a) => a.key === "plo_coverage")!;
    expect(plo.insufficientData).toBe(true);
    expect(plo.isWarning).toBe(true);
  });

  it("REGRESSION: quality warnings do NOT change the export gate (BR-019)", async () => {
    // The low-quality program has warnings, but is structurally valid (2 courses, 6
    // credits, name present). Export is governed ONLY by compliance: it needs a
    // justification for its (compliance) low-quality reference warning — NOT because of
    // the separate quality engine.
    await assessProgramQuality(lowProgram, "منى", { provider: clarityProvider(30, "low") });
    // Still blocked only by the compliance low-quality path, satisfiable by justification.
    await expect(attemptExport(lowProgram, "منى")).rejects.toBeInstanceOf(
      JustificationRequiredError,
    );
    const out = await attemptExport(lowProgram, "منى", { justification: "معتمد يدويًا" });
    expect(out.decision).toBe("needs_justification");
  });

  it("refuses anonymous quality assessment (rule 00)", async () => {
    await expect(assessProgramQuality(highProgram, "")).rejects.toThrow(/actor_name is required/);
  });
});
