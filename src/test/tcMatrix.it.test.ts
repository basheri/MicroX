// @vitest-environment node
//
// EP-22 — CONSOLIDATED TC-01..14 matrix (rule 70). One authoritative place that maps
// every mandatory boundary case to an executable assertion, so CI enforces the whole
// matrix. Per-epic tests remain the detailed coverage; this file is the traceable index.
//
// State of each TC is explicit:
//   passing  — proven here.
//   todo     — TC-08 only, genuinely blocked by the official template (V-01/V-06).
// No TC is turned into a false pass.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";

// --- Pure/domain boundary cases (no DB) ---
import {
  checkCourseCount,
  checkTotalCreditHours,
  checkCourseCreditHours,
  checkWeeklyLoad,
  checkCourseHoursSum,
} from "@/domain/businessRules";
import { assessQuality } from "@/domain/qualityEngine";
import { DEFAULT_QUALITY_CONFIG } from "@/config/qualityConfig";
import { evaluateBalance } from "@/domain/questionBalance";
import { isUsable, needsReview } from "@/domain/extractionGate";
import { extractIdentifier } from "@/domain/references";

// --- Services for the integration boundary cases ---
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import {
  seedComplianceRules,
  attemptExport,
  ExportBlockedError,
  JustificationRequiredError,
} from "@/services/complianceService";
import {
  publishProgram,
  openUpdateCycle,
  restoreVersion,
  getProgramVersions,
  PublishedLockError,
} from "@/services/versioningService";

describe("TC matrix (EP-22) — pure boundary cases", () => {
  it("TC-01 BR-001: <2 or >6 courses is blocked", () => {
    expect(checkCourseCount(1)?.severity).toBe("blocking");
    expect(checkCourseCount(7)?.severity).toBe("blocking");
    expect(checkCourseCount(4)).toBeNull();
  });

  it("TC-02 BR-002: total <3 or >23 credit hours is blocked", () => {
    expect(checkTotalCreditHours(2)?.severity).toBe("blocking");
    expect(checkTotalCreditHours(24)?.severity).toBe("blocking");
    expect(checkTotalCreditHours(12)).toBeNull();
  });

  it("TC-03 BR-003: course <1 or >10 credit hours is blocked", () => {
    expect(checkCourseCreditHours(0)?.severity).toBe("blocking");
    expect(checkCourseCreditHours(11)?.severity).toBe("blocking");
    expect(checkCourseCreditHours(3)).toBeNull();
  });

  it("TC-04 BR-005: weekly load >15 actual hours is blocked", () => {
    expect(checkWeeklyLoad(16)?.severity).toBe("blocking");
    expect(checkWeeklyLoad(15)).toBeNull();
  });

  it("TC-05 BR-006: course hours != credits×15 is blocked (recompute)", () => {
    expect(checkCourseHoursSum(3, 44)?.severity).toBe("blocking"); // expected 45
    expect(checkCourseHoursSum(3, 45)).toBeNull();
  });

  it("TC-06 §quality: an outcome not covered by content/exam is a WARNING (never blocks)", () => {
    const r = assessQuality(
      DEFAULT_QUALITY_CONFIG,
      {
        ploTotal: 4,
        ploUncovered: 2,
        cloTotal: 4,
        cloUncovered: 0,
        unitsTotal: 4,
        unitsUnaligned: 0,
        questionsTotal: 4,
        questionsUnlinked: 0,
        verifiedReferences: 1,
      },
      null,
    );
    const plo = r.axes.find((a) => a.key === "plo_coverage")!;
    expect(plo.isWarning).toBe(true);
    expect(r.blocksExport).toBe(false); // quality never blocks export
  });

  it("TC-07 §17: an unlinked question warns AND blocks the bank balance", () => {
    const report = evaluateBalance([
      { id: "q1", cloId: "c1", difficulty: "easy", optionCount: 4, correctCount: 1 },
      { id: "q2", cloId: null, difficulty: "easy", optionCount: 4, correctCount: 1 }, // unlinked
    ]);
    expect(report.balanced).toBe(false); // blocked
    expect(
      report.issues.some((i) => i.code === "question_unlinked" && i.severity === "warning"),
    ).toBe(true);
    expect(
      report.issues.some((i) => i.code === "balance_unlinked" && i.severity === "blocking"),
    ).toBe(true);
  });

  it("TC-09 AI-005: a low-confidence source is NOT usable until reviewed/approved", () => {
    expect(isUsable({ confidence: 0.2, reviewStatus: null })).toBe(false); // blocked
    expect(needsReview({ confidence: 0.2, reviewStatus: null })).toBe(true);
    expect(isUsable({ confidence: 0.2, reviewStatus: "approved" })).toBe(true); // human cleared it
  });

  it("TC-10 AI-004: a fabricated citation has no resolvable identifier (rejected/flagged)", () => {
    // No DOI / URL -> nothing to verify against -> flagged, not silently included.
    expect(extractIdentifier("مرجع مُختلَق بلا معرّف").kind).toBeNull();
    expect(extractIdentifier("Smith 2020, https://doi.org/10.1/x").kind).not.toBeNull();
  });

  it.todo(
    "TC-08 BR-013: official template missing required fields blocks export (needs V-01/V-06)",
  );
});

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("TC matrix (EP-22) — integration boundary cases", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("tcmatrix");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    await seedComplianceRules("منى");
    sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  async function newProgram(name: string) {
    return (await createProgram({ name, sectorId, fieldId }, "منى")).id;
  }

  it("TC-11 BR-019: export with a blocking error is prevented", async () => {
    const p = await newProgram("برنامج TC-11");
    await addCourse(p, { title: "مقرر وحيد", creditHours: 3 }, "منى"); // 1 course -> blocking
    await expect(attemptExport(p, "منى", { justification: "x" })).rejects.toBeInstanceOf(
      ExportBlockedError,
    );
  });

  it("TC-12 BR-019: low quality is allowed with a saved justification", async () => {
    const p = await newProgram("برنامج TC-12");
    await addCourse(p, { title: "م١", creditHours: 3 }, "منى");
    await addCourse(p, { title: "م٢", creditHours: 3 }, "منى"); // valid structure, 0 verified refs
    await expect(attemptExport(p, "منى")).rejects.toBeInstanceOf(JustificationRequiredError);
    const out = await attemptExport(p, "منى", { justification: "معتمد يدويًا" });
    expect(out.justification).toContain("معتمد");
    const audit = await getPool().query(
      "select override_justification from audit_logs where program_id=$1 and operation_type='program.export' order by occurred_at desc limit 1",
      [p],
    );
    expect(audit.rows[0].override_justification).toContain("معتمد");
  });

  it("TC-13 BR-020: editing a published version is blocked + opens an update cycle", async () => {
    const p = await newProgram("برنامج TC-13");
    await addCourse(p, { title: "م١", creditHours: 3 }, "منى");
    await addCourse(p, { title: "م٢", creditHours: 3 }, "منى");
    await publishProgram(p, "منى");
    await expect(addCourse(p, { title: "ممنوع", creditHours: 3 }, "منى")).rejects.toBeInstanceOf(
      PublishedLockError,
    );
    await openUpdateCycle(p, "منى");
    const id = await addCourse(p, { title: "بعد الفتح", creditHours: 3 }, "منى");
    expect(id).toBeTruthy();
  });

  it("TC-14 §versioning: restoring a prior version creates a new version + audit entry", async () => {
    const p = await newProgram("برنامج TC-14");
    await addCourse(p, { title: "م١", creditHours: 3 }, "منى");
    await addCourse(p, { title: "م٢", creditHours: 3 }, "منى");
    const published = await publishProgram(p, "منى");
    const before = (await getProgramVersions(p)).length;
    const restored = await restoreVersion(p, published, "منى");
    const after = await getProgramVersions(p);
    expect(after.length).toBe(before + 1);
    expect(after[0]!.version_no).toBe(restored);
    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where program_id=$1 and operation_type='program.version.restore'",
      [p],
    );
    expect(audit.rows[0].n).toBe(1);
  });
});
