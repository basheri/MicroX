// @vitest-environment node
//
// EP-11 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// content/resources/activities created, activities flagged formative-only (BR-009), and
// that a formative activity CANNOT contribute to the pass/fail determination.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse, addUnit, addLesson } from "@/services/academicService";
import {
  addResource,
  addActivity,
  addDesignAsset,
  listActivitiesForProgram,
} from "@/services/contentService";
import { determinePassFail } from "@/domain/assessment";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-11 — content & instructional design (integration)", () => {
  let db: IsolatedDb;
  let programId: string;
  let lessonId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep11");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (await createProgram({ name: "برنامج المحتوى", sectorId, fieldId }, "منى")).id;
    const courseId = await addCourse(programId, { title: "مقرر", creditHours: 3 }, "منى");
    const unitId = await addUnit(courseId, "وحدة", "منى");
    lessonId = await addLesson(unitId, { title: "درس" }, "منى");
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("creates resources, formative activities, and design assets", async () => {
    await addResource(
      lessonId,
      { resourceType: "video", title: "مقطع", durationMinutes: 10 },
      "منى",
    );
    await addActivity(lessonId, { title: "نشاط تدريبي" }, "منى");
    await addDesignAsset({ lessonId, assetType: "video_script", content: "نص السيناريو" }, "منى");

    const activities = await listActivitiesForProgram(programId);
    expect(activities.length).toBe(1);
    expect(activities[0]!.is_formative).toBe(true); // BR-009

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type in ('resource.create','activity.create','design_asset.create')",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it("stores every activity as formative-only (is_formative cannot be false)", async () => {
    await addActivity(lessonId, { title: "نشاط آخر" }, "منى");
    const rows = await getPool().query<{ is_formative: boolean }>(
      `select a.is_formative from learning_activities a
         join lessons l on l.id = a.lesson_id
         join course_units u on u.id = l.unit_id
         join courses c on c.id = u.course_id
        where c.program_id = $1`,
      [programId],
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.is_formative === true)).toBe(true);
  });

  // The required proof: a formative activity cannot change pass/fail (BR-008/BR-009).
  it("a formative activity cannot contribute to the pass/fail determination", async () => {
    const activities = (await listActivitiesForProgram(programId)).map((a) => ({
      isFormative: a.is_formative,
      completed: true,
      scorePct: 100,
    }));
    expect(activities.every((a) => a.isFormative)).toBe(true);

    // Failing the final exam => FAIL, even though every formative activity is "completed".
    const withActivities = determinePassFail({
      finalExamScorePct: 30,
      passMarkPct: 60,
      activities,
    });
    const withoutActivities = determinePassFail({ finalExamScorePct: 30, passMarkPct: 60 });
    expect(withActivities.passed).toBe(false);
    expect(withActivities).toEqual(withoutActivities); // activities made no difference
    expect(withActivities.basis).toBe("final_exam");
  });

  it("refuses anonymous content creation (rule 00)", async () => {
    await expect(addActivity(lessonId, { title: "x" }, "")).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
