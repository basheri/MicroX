// Academic structure service (EP-10). Courses / units / lessons / PLOs / CLOs and the
// alignment matrix, with BR-001 (2..6 courses) and BR-003 (1..10 credit hours) ENFORCED
// on real course data, plus TC-06 gap detectors (uncovered outcome / content w/o outcome).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import { ProgramRuleError } from "@/services/programService";
import { assertEditable } from "@/services/versioningService";
import {
  countActiveCourses,
  sumCreditHours,
  insertCourse,
  updateCourse,
  softDeleteCourse,
  getCourse,
  listCourses,
  insertPLO,
  insertCLO,
  insertUnit,
  insertLesson,
  insertAlignment,
  listAlignment,
  uncoveredPLOs,
  uncoveredCLOs,
  contentWithoutOutcome,
  type AlignmentLink,
} from "@/data/academicRepo";
import {
  BR,
  checkCourseCreditHours,
  checkCourseCount,
  checkProgramStructure,
  actualHoursForCredits,
  type RuleIssue,
} from "@/domain/businessRules";

async function requireProgram(programId: string) {
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("program not found");
  return program;
}

// Add a course — enforces BR-003 (1..10 credit hours) and BR-001's upper bound
// (cannot exceed 6 courses). actual_hours is derived from credits (BR-004).
export async function addCourse(
  programId: string,
  input: { title: string; creditHours: number },
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await requireProgram(programId);
  await assertEditable(programId); // BR-020: no edits to a published (locked) program.

  // BR-003: per-course credit-hour bounds.
  const creditIssue = checkCourseCreditHours(input.creditHours);
  if (creditIssue) throw new ProgramRuleError([creditIssue]);

  // BR-001 (upper): a program has at most 6 courses.
  const count = await countActiveCourses(programId);
  if (count >= BR.COURSES_MAX) {
    throw new ProgramRuleError([
      {
        ruleCode: "BR-001",
        severity: "blocking",
        message: `لا يمكن إضافة أكثر من ${BR.COURSES_MAX} مقررات للبرنامج (القاعدة BR-001).`,
      },
    ]);
  }

  const actualHours = actualHoursForCredits(input.creditHours);
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let courseId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "course.create",
        program_id: programId,
        new_value: { title: input.title, creditHours: input.creditHours, actualHours },
      },
      async () => {
        courseId = await insertCourse(client, {
          programId,
          title: input.title,
          creditHours: input.creditHours,
          actualHours,
          actor,
        });
      },
      sink,
    );
    return courseId;
  });
}

export async function editCourse(
  courseId: string,
  input: { title?: string; creditHours?: number },
  actor: string,
): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  if (input.creditHours !== undefined) {
    const issue = checkCourseCreditHours(input.creditHours);
    if (issue) throw new ProgramRuleError([issue]);
  }
  const actualHours =
    input.creditHours !== undefined ? actualHoursForCredits(input.creditHours) : undefined;
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "course.update", new_value: { courseId, ...input } },
      async () => {
        await updateCourse(client, courseId, { ...input, actualHours });
      },
      sink,
    );
  });
}

export async function removeCourse(courseId: string, actor: string): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "course.soft_delete", new_value: { courseId } },
      async () => {
        await softDeleteCourse(client, courseId);
      },
      sink,
    );
  });
}

// Validate the whole program's course structure (BR-001 range + BR-002 total credits).
export async function validateProgramCourses(programId: string): Promise<RuleIssue[]> {
  const [count, total] = await Promise.all([
    countActiveCourses(programId),
    sumCreditHours(programId),
  ]);
  return checkProgramStructure({ courseCount: count, totalCreditHours: total });
}

// Convenience: does the course count satisfy BR-001 (2..6)?
export async function checkCourseCountRule(programId: string): Promise<RuleIssue | null> {
  return checkCourseCount(await countActiveCourses(programId));
}

// --- Outcomes / units / lessons (alignment chain is editable) ---
async function auditedInsert<T>(
  actor: string,
  op: string,
  meta: Record<string, unknown>,
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let result!: T;
    await withAudit(
      { actor_name: actor, operation_type: op, new_value: meta },
      async () => {
        result = await fn(client);
      },
      sink,
    );
    return result;
  });
}

export function addPLO(programId: string, statement: string, actor: string, bloomVerb?: string) {
  return auditedInsert(actor, "plo.create", { programId, statement }, (c) =>
    insertPLO(c, { programId, statement, bloomVerb }),
  );
}
export function addCLO(courseId: string, statement: string, actor: string) {
  return auditedInsert(actor, "clo.create", { courseId, statement }, (c) =>
    insertCLO(c, { courseId, statement }),
  );
}
export function addUnit(courseId: string, title: string, actor: string) {
  return auditedInsert(actor, "unit.create", { courseId, title }, (c) =>
    insertUnit(c, { courseId, title }),
  );
}
export function addLesson(
  unitId: string,
  input: { title: string; objective?: string; durationMinutes?: number },
  actor: string,
) {
  return auditedInsert(actor, "lesson.create", { unitId, ...input }, (c) =>
    insertLesson(c, { unitId, ...input }),
  );
}

export function linkAlignment(programId: string, link: AlignmentLink, actor: string) {
  return auditedInsert(actor, "alignment.link", { programId, ...link }, (c) =>
    insertAlignment(c, programId, link),
  );
}

export interface AlignmentGaps {
  uncoveredPLOs: { id: string; statement: string }[];
  uncoveredCLOs: { id: string; statement: string }[];
  contentWithoutOutcome: { id: string; title: string }[];
}

// TC-06 gap detectors — outcomes not covered, and content not linked to an outcome.
// These are WARNINGS (gaps in the alignment chain, BR-015..018), not blocking.
export async function detectAlignmentGaps(programId: string): Promise<AlignmentGaps> {
  const [plos, clos, content] = await Promise.all([
    uncoveredPLOs(programId),
    uncoveredCLOs(programId),
    contentWithoutOutcome(programId),
  ]);
  return { uncoveredPLOs: plos, uncoveredCLOs: clos, contentWithoutOutcome: content };
}

export { listCourses, getCourse, listAlignment };
