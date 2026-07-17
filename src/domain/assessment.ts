// Assessment policy (BR-008 / BR-009). PURE. Passing is determined ONLY by the final
// comprehensive exam (BR-008); formative activities are NEVER counted toward passing
// (BR-009). This module is the single source of the pass/fail rule.

export type AssessmentKind = "formative_activity" | "final_exam";

// Passing is decided solely by this source (BR-008).
export const PASSING_BASIS: AssessmentKind = "final_exam";

// Does an assessment item contribute to the pass/fail determination?
// Only the final comprehensive exam does — a formative activity never does (BR-009).
export function isCountedTowardPassing(kind: AssessmentKind): boolean {
  return kind === PASSING_BASIS;
}

export interface PassFailInput {
  finalExamScorePct: number;
  passMarkPct: number;
  // Activities are accepted ONLY to make it explicit they are ignored — passing the
  // result must be identical regardless of what appears here (BR-009).
  activities?: { isFormative: boolean; completed?: boolean; scorePct?: number }[];
}

export interface PassFailResult {
  passed: boolean;
  basis: AssessmentKind;
}

// Determine pass/fail from the final comprehensive exam ONLY. Activities never affect it.
export function determinePassFail(input: PassFailInput): PassFailResult {
  return {
    passed: input.finalExamScorePct >= input.passMarkPct,
    basis: PASSING_BASIS,
  };
}

// Guard: learning activities must be formative-only. A non-formative activity would
// violate BR-009 (a "summative activity" is not allowed — only the final exam is summative).
export function assertFormativeOnly(activities: { isFormative: boolean }[]): void {
  if (activities.some((a) => !a.isFormative)) {
    throw new Error("BR-009: الأنشطة تكوينية فقط ولا تُحتسب في تحديد النجاح.");
  }
}
