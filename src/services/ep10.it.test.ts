// @vitest-environment node
//
// EP-10 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// the alignment chain is editable; gap detectors flag gaps (TC-06); and BR-001 (2..6
// courses) + BR-003 (1..10 credit hours) are ENFORCED on real course data.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { ProgramRuleError } from "@/services/programService";
import {
  addCourse,
  editCourse,
  addPLO,
  addCLO,
  addUnit,
  linkAlignment,
  detectAlignmentGaps,
  validateProgramCourses,
  listCourses,
  getCourse,
} from "@/services/academicService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-10 — courses, outcomes & alignment (integration)", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep10");
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

  // BR-003 boundaries on real data.
  it("BR-003: blocks a course with <1 or >10 credit hours; allows 1 and 10", async () => {
    const programId = await newProgram("مقررات");
    await expect(
      addCourse(programId, { title: "أ", creditHours: 0 }, "منى"),
    ).rejects.toBeInstanceOf(ProgramRuleError);
    await expect(
      addCourse(programId, { title: "ب", creditHours: 11 }, "منى"),
    ).rejects.toBeInstanceOf(ProgramRuleError);
    const c1 = await addCourse(programId, { title: "حد أدنى", creditHours: 1 }, "منى");
    const c10 = await addCourse(programId, { title: "حد أعلى", creditHours: 10 }, "منى");
    expect((await getCourse(c1))!.actual_hours).toBe(15); // BR-004 conversion
    expect((await getCourse(c10))!.actual_hours).toBe(150);
  });

  // BR-001 boundaries on real data.
  it("BR-001: allows up to 6 courses, blocks the 7th; flags <2 courses", async () => {
    const programId = await newProgram("عدد المقررات");
    for (let i = 1; i <= 6; i++) {
      await addCourse(programId, { title: `مقرر ${i}`, creditHours: 2 }, "منى");
    }
    expect((await listCourses(programId)).length).toBe(6);
    // 7th course blocked by BR-001 upper bound.
    await expect(
      addCourse(programId, { title: "السابع", creditHours: 2 }, "منى"),
    ).rejects.toBeInstanceOf(ProgramRuleError);

    // A program with only 1 course fails the BR-001 range check.
    const solo = await newProgram("مقرر واحد");
    await addCourse(solo, { title: "وحيد", creditHours: 3 }, "منى");
    const issues = await validateProgramCourses(solo);
    expect(issues.map((i) => i.ruleCode)).toContain("BR-001");
  });

  it("editing a course re-enforces BR-003", async () => {
    const programId = await newProgram("تعديل");
    const id = await addCourse(programId, { title: "م", creditHours: 3 }, "منى");
    await expect(editCourse(id, { creditHours: 20 }, "منى")).rejects.toBeInstanceOf(
      ProgramRuleError,
    );
    await editCourse(id, { creditHours: 4 }, "منى");
    expect((await getCourse(id))!.actual_hours).toBe(60);
  });

  // TC-06 — gap detectors flag uncovered outcomes and content without an outcome.
  it("TC-06: detects uncovered outcomes and content without an outcome; gaps clear once linked", async () => {
    const programId = await newProgram("مواءمة");
    const courseId = await addCourse(programId, { title: "مقرر", creditHours: 3 }, "منى");
    const ploId = await addPLO(programId, "يحلل الطالب البيانات", "منى");
    const cloId = await addCLO(courseId, "يستخدم أدوات التحليل", "منى");
    const unitId = await addUnit(courseId, "الوحدة الأولى", "منى");

    let gaps = await detectAlignmentGaps(programId);
    expect(gaps.uncoveredPLOs.map((p) => p.id)).toContain(ploId);
    expect(gaps.uncoveredCLOs.map((c) => c.id)).toContain(cloId);
    expect(gaps.contentWithoutOutcome.map((u) => u.id)).toContain(unitId);

    // Link the chain: PLO<-CLO<-unit in one alignment row.
    await linkAlignment(programId, { ploId, cloId, unitId }, "منى");

    gaps = await detectAlignmentGaps(programId);
    expect(gaps.uncoveredPLOs.map((p) => p.id)).not.toContain(ploId);
    expect(gaps.uncoveredCLOs.map((c) => c.id)).not.toContain(cloId);
    expect(gaps.contentWithoutOutcome.map((u) => u.id)).not.toContain(unitId);
  });

  it("refuses anonymous course creation (rule 00)", async () => {
    const programId = await newProgram("بدون فاعل");
    await expect(addCourse(programId, { title: "x", creditHours: 3 }, "")).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
