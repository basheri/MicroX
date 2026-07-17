import { describe, it, expect } from "vitest";
import {
  checkWeeklyLoad,
  checkCourseHoursSum,
  computeWeeklyLoad,
  BR,
} from "@/domain/businessRules";

// BR-005 — weekly load <= 15 actual hours.
describe("BR-005 weekly load (TC-04)", () => {
  it("blocks a weekly load above 15", () => {
    expect(checkWeeklyLoad(15.5)?.ruleCode).toBe("BR-005");
    expect(checkWeeklyLoad(22.5)?.ruleCode).toBe("BR-005");
  });
  it("allows a weekly load of 15 or below", () => {
    expect(checkWeeklyLoad(BR.MAX_WEEKLY_ACTUAL_HOURS)).toBeNull();
    expect(checkWeeklyLoad(10)).toBeNull();
  });
  it("computes weekly load as total actual / weeks", () => {
    expect(computeWeeklyLoad(45, 3)).toBe(15);
    expect(computeWeeklyLoad(45, 2)).toBe(22.5);
  });
});

// BR-006 — a course's hours must sum to credit_hours × 15.
describe("BR-006 course hours = credits × 15 (TC-05)", () => {
  it("blocks a distribution that does not sum to credits × 15", () => {
    expect(checkCourseHoursSum(3, 40)?.ruleCode).toBe("BR-006"); // expected 45
    expect(checkCourseHoursSum(2, 45)?.ruleCode).toBe("BR-006"); // expected 30
  });
  it("allows the exact expected total", () => {
    expect(checkCourseHoursSum(3, 45)).toBeNull();
    expect(checkCourseHoursSum(1, 15)).toBeNull();
  });
  it("surfaces the recomputed expected total in the message", () => {
    expect(checkCourseHoursSum(4, 10)!.message).toContain("60");
  });
});
