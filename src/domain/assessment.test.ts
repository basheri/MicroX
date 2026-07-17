import { describe, it, expect } from "vitest";
import {
  determinePassFail,
  isCountedTowardPassing,
  assertFormativeOnly,
  PASSING_BASIS,
} from "@/domain/assessment";

describe("assessment policy (BR-008 / BR-009)", () => {
  it("passing is based only on the final comprehensive exam (BR-008)", () => {
    expect(PASSING_BASIS).toBe("final_exam");
    expect(isCountedTowardPassing("final_exam")).toBe(true);
    expect(isCountedTowardPassing("formative_activity")).toBe(false); // BR-009
  });

  // The core proof: a formative activity cannot contribute to pass/fail.
  it("formative activities NEVER change the pass/fail result (BR-009)", () => {
    const noActivities = determinePassFail({ finalExamScorePct: 40, passMarkPct: 60 });
    const allActivitiesDone = determinePassFail({
      finalExamScorePct: 40,
      passMarkPct: 60,
      activities: [
        { isFormative: true, completed: true, scorePct: 100 },
        { isFormative: true, completed: true, scorePct: 100 },
      ],
    });
    // Same failing exam -> same FAIL, regardless of completed activities.
    expect(noActivities.passed).toBe(false);
    expect(allActivitiesDone.passed).toBe(false);
    expect(allActivitiesDone).toEqual(noActivities);
  });

  it("a passing exam passes even with zero/failed activities", () => {
    expect(determinePassFail({ finalExamScorePct: 70, passMarkPct: 60 }).passed).toBe(true);
    expect(
      determinePassFail({
        finalExamScorePct: 70,
        passMarkPct: 60,
        activities: [{ isFormative: true, completed: false, scorePct: 0 }],
      }).passed,
    ).toBe(true);
  });

  it("rejects a non-formative activity (BR-009 guard)", () => {
    expect(() => assertFormativeOnly([{ isFormative: false }])).toThrow(/BR-009/);
    expect(() => assertFormativeOnly([{ isFormative: true }])).not.toThrow();
  });
});
