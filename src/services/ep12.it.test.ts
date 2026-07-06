// @vitest-environment node
//
// EP-12 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// hours recompute live; violations blocked — TC-02 (total credits), TC-03 (course
// credits), TC-04 (weekly load > 15), TC-05 (course hours != credits × 15).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import { ProgramRuleError } from "@/services/programService";
import {
  recomputeHours,
  setSchedule,
  setCourseHourAllocations,
  getSchedule,
} from "@/services/schedulingService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-12 — hours & scheduling (integration)", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep12");
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

  it("recomputes hours live (total credits + actual hours via credits × 15)", async () => {
    const programId = await newProgram("جدولة");
    await addCourse(programId, { title: "أ", creditHours: 3 }, "منى");
    await addCourse(programId, { title: "ب", creditHours: 4 }, "منى");
    const r = await recomputeHours(programId);
    expect(r.totalCredit).toBe(7);
    expect(r.totalActual).toBe(7 * 15); // 105 (BR-004/006)
    expect(r.issues).toEqual([]); // 7 credits is within 3..23
  });

  // TC-02 — total credit hours outside 3..23 is blocked (surfaced as a BR-002 issue).
  it("TC-02: flags a total below 3 or above 23", async () => {
    const low = await newProgram("قليل");
    await addCourse(low, { title: "أ", creditHours: 2 }, "منى"); // total 2 < 3
    expect((await recomputeHours(low)).issues.map((i) => i.ruleCode)).toContain("BR-002");

    const high = await newProgram("كثير");
    for (const c of [6, 6, 6, 6]) await addCourse(high, { title: "م", creditHours: c }, "منى"); // 24 > 23
    expect((await recomputeHours(high)).issues.map((i) => i.ruleCode)).toContain("BR-002");
  });

  // TC-03 — course credit hours outside 1..10 is blocked (at creation).
  it("TC-03: blocks a course with credit hours <1 or >10", async () => {
    const programId = await newProgram("مقرر");
    await expect(
      addCourse(programId, { title: "x", creditHours: 0 }, "منى"),
    ).rejects.toBeInstanceOf(ProgramRuleError);
    await expect(
      addCourse(programId, { title: "y", creditHours: 11 }, "منى"),
    ).rejects.toBeInstanceOf(ProgramRuleError);
  });

  // TC-04 — weekly load > 15 actual hours is blocked (BR-005).
  it("TC-04: blocks a schedule whose weekly load exceeds 15", async () => {
    const programId = await newProgram("حمل");
    await addCourse(programId, { title: "أ", creditHours: 3 }, "منى"); // 45 actual hours
    // 45 / 2 = 22.5 > 15 -> blocked, nothing persisted.
    await expect(setSchedule(programId, 2, "منى")).rejects.toBeInstanceOf(ProgramRuleError);
    expect(await getSchedule(programId)).toBeNull();

    // 45 / 3 = 15 -> allowed.
    const schedule = await setSchedule(programId, 3, "منى");
    expect(schedule.weekly_load).toBe(15);
    expect(schedule.weeks).toBe(3);
  });

  // TC-05 — a course's hours must sum to credits × 15; a mismatch is blocked + recomputed.
  it("TC-05: blocks hour allocations that do not sum to credits × 15", async () => {
    const programId = await newProgram("توزيع");
    const courseId = await addCourse(programId, { title: "أ", creditHours: 3 }, "منى"); // expected 45
    try {
      await setCourseHourAllocations(courseId, [{ hours: 20 }, { hours: 20 }], "منى"); // 40 != 45
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProgramRuleError);
      expect((err as ProgramRuleError).issues[0]!.ruleCode).toBe("BR-006");
      expect((err as ProgramRuleError).issues[0]!.message).toContain("45"); // recomputed expected
    }
    // A correct distribution (sums to 45) is accepted and persisted.
    await setCourseHourAllocations(courseId, [{ hours: 30 }, { hours: 15 }], "منى");
    const rows = await getPool().query("select id from hour_allocations where course_id=$1", [
      courseId,
    ]);
    expect(rows.rows.length).toBe(2);
  });

  it("refuses anonymous schedule/hour changes (rule 00)", async () => {
    const programId = await newProgram("بدون فاعل");
    await addCourse(programId, { title: "أ", creditHours: 3 }, "منى");
    await expect(setSchedule(programId, 3, "")).rejects.toThrow(/actor_name is required/);
  });
});
