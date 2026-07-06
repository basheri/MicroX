// Hours & scheduling service (EP-12). Live recompute of program hours + BR enforcement:
// BR-002 (total credits 3..23), BR-005 (weekly load <= 15 actual hours), BR-006 (a
// course's hour distribution sums to credit_hours × 15). Violations are blocked.

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram, type Program } from "@/data/programsRepo";
import { getCourse, countActiveCourses, sumCreditHours } from "@/data/academicRepo";
import {
  replaceHourAllocations,
  listHourAllocations,
  sumCourseActualHours,
  getSchedule,
  upsertSchedule,
  type HourAllocationInput,
  type ScheduleRow,
} from "@/data/hoursRepo";
import { ProgramRuleError } from "@/services/programService";
import {
  checkTotalCreditHours,
  checkWeeklyLoad,
  checkCourseHoursSum,
  computeWeeklyLoad,
  actualHoursForCredits,
  type RuleIssue,
} from "@/domain/businessRules";

async function requireProgram(programId: string): Promise<Program> {
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("program not found");
  return program;
}

export interface HoursRecompute {
  courseCount: number;
  totalCredit: number;
  totalActual: number;
  weeks: number | null;
  weeklyLoad: number | null;
  issues: RuleIssue[];
}

// LIVE recompute: totals + weekly load + all current violations (BR-002 + BR-005).
// Read-only — does not persist. `weeks` falls back to the stored schedule.
export async function recomputeHours(
  programId: string,
  opts: { weeks?: number } = {},
): Promise<HoursRecompute> {
  await requireProgram(programId);
  const [courseCount, totalCredit, totalActual, existing] = await Promise.all([
    countActiveCourses(programId),
    sumCreditHours(programId),
    sumCourseActualHours(programId),
    getSchedule(programId),
  ]);
  const weeks = opts.weeks ?? existing?.weeks ?? null;
  const weeklyLoad = weeks ? computeWeeklyLoad(totalActual, weeks) : null;

  const issues: RuleIssue[] = [];
  const totalIssue = checkTotalCreditHours(totalCredit);
  if (totalIssue) issues.push(totalIssue); // BR-002
  if (weeklyLoad !== null) {
    const loadIssue = checkWeeklyLoad(weeklyLoad);
    if (loadIssue) issues.push(loadIssue); // BR-005
  }
  return { courseCount, totalCredit, totalActual, weeks, weeklyLoad, issues };
}

// Set the number of weeks and persist the recomputed schedule. BR-005 blocks a weekly
// load above 15 (nothing is persisted on violation).
export async function setSchedule(
  programId: string,
  weeks: number,
  actor: string,
): Promise<ScheduleRow> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  if (!Number.isInteger(weeks) || weeks <= 0)
    throw new Error("عدد الأسابيع يجب أن يكون عددًا موجبًا.");

  const recompute = await recomputeHours(programId, { weeks });
  const weeklyLoad = recompute.weeklyLoad!;
  const loadIssue = checkWeeklyLoad(weeklyLoad);
  if (loadIssue) throw new ProgramRuleError([loadIssue]); // BR-005 — block, do not persist

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "schedule.set",
        program_id: programId,
        new_value: { weeks, weeklyLoad, totalActual: recompute.totalActual },
      },
      async () => {
        await upsertSchedule(client, {
          programId,
          totalCredit: recompute.totalCredit,
          totalActual: recompute.totalActual,
          weeks,
          weeklyLoad,
        });
      },
      sink,
    );
  });
  return (await getSchedule(programId))!;
}

// Set a course's hour distribution. BR-006 blocks when the sum != credit_hours × 15
// (the expected total is recomputed and returned in the error).
export async function setCourseHourAllocations(
  courseId: string,
  allocations: HourAllocationInput[],
  actor: string,
): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const course = await getCourse(courseId);
  if (!course) throw new Error("course not found");

  const allocated = allocations.reduce((sum, a) => sum + Number(a.hours), 0);
  const sumIssue = checkCourseHoursSum(course.credit_hours, allocated); // BR-006
  if (sumIssue) throw new ProgramRuleError([sumIssue]);

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "hours.allocate",
        new_value: { courseId, allocated, expected: actualHoursForCredits(course.credit_hours) },
      },
      async () => {
        await replaceHourAllocations(client, courseId, allocations);
      },
      sink,
    );
  });
}

export { listHourAllocations, getSchedule };
