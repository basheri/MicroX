import { describe, it, expect } from "vitest";
import {
  checkCourseCount,
  checkTotalCreditHours,
  checkProgramStructure,
  BR,
} from "@/domain/businessRules";

// TC-01 — BR-001: a program must have 2..6 courses (outside the range is blocking).
describe("BR-001 course count (TC-01)", () => {
  it("blocks fewer than 2 courses", () => {
    const issue = checkCourseCount(1);
    expect(issue?.ruleCode).toBe("BR-001");
    expect(issue?.severity).toBe("blocking");
  });
  it("blocks more than 6 courses", () => {
    expect(checkCourseCount(7)?.ruleCode).toBe("BR-001");
  });
  it("allows the boundaries 2 and 6 and values within", () => {
    expect(checkCourseCount(BR.COURSES_MIN)).toBeNull();
    expect(checkCourseCount(4)).toBeNull();
    expect(checkCourseCount(BR.COURSES_MAX)).toBeNull();
  });
});

// TC-02 — BR-002: program total credit hours must be 3..23 (outside is blocking).
describe("BR-002 total credit hours (TC-02)", () => {
  it("blocks fewer than 3 total credit hours", () => {
    const issue = checkTotalCreditHours(2);
    expect(issue?.ruleCode).toBe("BR-002");
    expect(issue?.severity).toBe("blocking");
  });
  it("blocks more than 23 total credit hours", () => {
    expect(checkTotalCreditHours(24)?.ruleCode).toBe("BR-002");
  });
  it("allows the boundaries 3 and 23 and values within", () => {
    expect(checkTotalCreditHours(BR.TOTAL_CREDITS_MIN)).toBeNull();
    expect(checkTotalCreditHours(12)).toBeNull();
    expect(checkTotalCreditHours(BR.TOTAL_CREDITS_MAX)).toBeNull();
  });
});

describe("checkProgramStructure aggregation", () => {
  it("returns both violations for an empty program", () => {
    const issues = checkProgramStructure({ courseCount: 0, totalCreditHours: 0 });
    expect(issues.map((i) => i.ruleCode).sort()).toEqual(["BR-001", "BR-002"]);
  });
  it("returns no issues for a valid structure", () => {
    expect(checkProgramStructure({ courseCount: 3, totalCreditHours: 12 })).toEqual([]);
  });
  it("messages are Arabic and cite the rule", () => {
    const issue = checkCourseCount(0)!;
    expect(issue.message).toContain("BR-001");
    expect(issue.message).toMatch(/[؀-ۿ]/); // contains Arabic
  });
});
