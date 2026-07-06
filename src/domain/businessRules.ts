// Business-rule constants & validators (rule 10-business-rules.md).
// PURE and framework-free so they are trivially unit-testable and enforced in CI.
// Only values explicitly written in rule 10 are encoded here — nothing invented.
// Validation messages are Arabic with the rule reference (rule 50-arabic-rtl-ui).

export const BR = {
  COURSES_MIN: 2, // BR-001
  COURSES_MAX: 6, // BR-001
  TOTAL_CREDITS_MIN: 3, // BR-002
  TOTAL_CREDITS_MAX: 23, // BR-002
  COURSE_CREDITS_MIN: 1, // BR-003 (enforced in EP-10; also a DB CHECK)
  COURSE_CREDITS_MAX: 10, // BR-003
  HOURS_PER_CREDIT: 15, // BR-004
  MAX_WEEKLY_ACTUAL_HOURS: 15, // BR-005
} as const;

export type Severity = "blocking" | "warning" | "suggestion";

export interface RuleIssue {
  ruleCode: string;
  severity: Severity;
  message: string; // Arabic, user-facing
}

// BR-001 — a program has 2 to 6 courses. Outside that range is blocking.
export function checkCourseCount(courseCount: number): RuleIssue | null {
  if (courseCount < BR.COURSES_MIN || courseCount > BR.COURSES_MAX) {
    return {
      ruleCode: "BR-001",
      severity: "blocking",
      message: `يجب أن يحتوي البرنامج على ${BR.COURSES_MIN} إلى ${BR.COURSES_MAX} مقررات (القاعدة BR-001). العدد الحالي: ${courseCount}.`,
    };
  }
  return null;
}

// BR-002 — program total credit hours must be 3 to 23. Outside that range is blocking.
export function checkTotalCreditHours(totalCreditHours: number): RuleIssue | null {
  if (totalCreditHours < BR.TOTAL_CREDITS_MIN || totalCreditHours > BR.TOTAL_CREDITS_MAX) {
    return {
      ruleCode: "BR-002",
      severity: "blocking",
      message: `يجب أن يكون إجمالي الساعات المعتمدة للبرنامج بين ${BR.TOTAL_CREDITS_MIN} و ${BR.TOTAL_CREDITS_MAX} (القاعدة BR-002). الإجمالي الحالي: ${totalCreditHours}.`,
    };
  }
  return null;
}

// BR-003 — each course must have 1 to 10 credit hours. (Also a DB CHECK.)
export function checkCourseCreditHours(creditHours: number): RuleIssue | null {
  if (
    !Number.isFinite(creditHours) ||
    creditHours < BR.COURSE_CREDITS_MIN ||
    creditHours > BR.COURSE_CREDITS_MAX
  ) {
    return {
      ruleCode: "BR-003",
      severity: "blocking",
      message: `يجب أن تكون الساعات المعتمدة للمقرر بين ${BR.COURSE_CREDITS_MIN} و ${BR.COURSE_CREDITS_MAX} (القاعدة BR-003). القيمة الحالية: ${creditHours}.`,
    };
  }
  return null;
}

// BR-004 — fixed conversion: 1 credit hour = 15 actual learning hours.
export function actualHoursForCredits(creditHours: number): number {
  return creditHours * BR.HOURS_PER_CREDIT;
}

// BR-005 — max 15 actual learning hours per week of learner load. Above that is blocking.
export function checkWeeklyLoad(weeklyLoadHours: number): RuleIssue | null {
  if (weeklyLoadHours > BR.MAX_WEEKLY_ACTUAL_HOURS) {
    return {
      ruleCode: "BR-005",
      severity: "blocking",
      message: `الحمل الأسبوعي (${weeklyLoadHours} ساعة فعلية) يتجاوز الحد الأقصى ${BR.MAX_WEEKLY_ACTUAL_HOURS} ساعة/أسبوع (القاعدة BR-005).`,
    };
  }
  return null;
}

// Weekly load = total actual hours spread across the number of weeks.
export function computeWeeklyLoad(totalActualHours: number, weeks: number): number {
  if (weeks <= 0) return Infinity;
  return totalActualHours / weeks;
}

// BR-006 — a course's hour distribution must sum to credit_hours × 15. The expected total
// is recomputed here; a mismatch is blocking.
export function checkCourseHoursSum(
  creditHours: number,
  allocatedActualHours: number,
): RuleIssue | null {
  const expected = actualHoursForCredits(creditHours);
  if (allocatedActualHours !== expected) {
    return {
      ruleCode: "BR-006",
      severity: "blocking",
      message: `توزيع ساعات المقرر (${allocatedActualHours}) لا يساوي الساعات المطلوبة ${expected} = ${creditHours}×${BR.HOURS_PER_CREDIT} (القاعدة BR-006).`,
    };
  }
  return null;
}

// Aggregate the structural export-gate checks available at the program level.
// (More contributors — outcomes/hours/questions coverage — are added in their epics.)
export function checkProgramStructure(input: {
  courseCount: number;
  totalCreditHours: number;
}): RuleIssue[] {
  return [
    checkCourseCount(input.courseCount),
    checkTotalCreditHours(input.totalCreditHours),
  ].filter((i): i is RuleIssue => i !== null);
}
