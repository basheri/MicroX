import { describe, it, expect } from "vitest";
import { checkCourseCreditHours, actualHoursForCredits, BR } from "@/domain/businessRules";

// TC-03 — BR-003: each course must have 1..10 credit hours.
describe("BR-003 course credit hours (TC-03)", () => {
  it("blocks fewer than 1 credit hour", () => {
    expect(checkCourseCreditHours(0)?.ruleCode).toBe("BR-003");
    expect(checkCourseCreditHours(0.5)?.ruleCode).toBe("BR-003");
  });
  it("blocks more than 10 credit hours", () => {
    expect(checkCourseCreditHours(11)?.ruleCode).toBe("BR-003");
  });
  it("allows the boundaries 1 and 10 and values within", () => {
    expect(checkCourseCreditHours(BR.COURSE_CREDITS_MIN)).toBeNull();
    expect(checkCourseCreditHours(5)).toBeNull();
    expect(checkCourseCreditHours(BR.COURSE_CREDITS_MAX)).toBeNull();
  });
});

// BR-004 — 1 credit hour = 15 actual hours.
describe("BR-004 hours conversion", () => {
  it("converts credits to 15 actual hours each", () => {
    expect(actualHoursForCredits(1)).toBe(15);
    expect(actualHoursForCredits(3)).toBe(45);
  });
});
