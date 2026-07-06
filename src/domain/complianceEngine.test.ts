import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  evaluateRules,
  classifyFailures,
  hasBlockingFailure,
  hasLowQualityFailure,
  exportDecision,
  type EvalRule,
} from "@/domain/complianceEngine";

const coursesRule: EvalRule = {
  ruleCode: "COMP-BR-001",
  severity: "blocking",
  ruleType: "numeric_min_max",
  factKey: "courses_count",
  params: { min: 2, max: 6 },
  message: "المقررات خارج النطاق 2–6. الحالي: {value}.",
};

const refsRule: EvalRule = {
  ruleCode: "COMP-QUALITY-REFERENCES",
  severity: "warning",
  ruleType: "numeric_min",
  factKey: "verified_references_count",
  params: { min: 1 },
  message: "يُفضّل مرجع موثّق واحد على الأقل.",
};

const nameRule: EvalRule = {
  ruleCode: "COMP-FIELD-PROGRAM-NAME",
  severity: "blocking",
  ruleType: "required_present",
  factKey: "program_name_present",
  params: {},
  message: "اسم البرنامج إلزامي.",
};

describe("complianceEngine (D-08 / BR-019) — pure evaluator", () => {
  it("numeric_min_max passes inside the range and fails outside (with the observed value)", () => {
    expect(evaluateRule(coursesRule, { courses_count: 3 }).passed).toBe(true);

    const low = evaluateRule(coursesRule, { courses_count: 1 });
    expect(low.passed).toBe(false);
    expect(low.message).toContain("1"); // {value} interpolated
    expect(evaluateRule(coursesRule, { courses_count: 7 }).passed).toBe(false);
  });

  it("required_present fails on a 0/absent flag and passes when present", () => {
    expect(evaluateRule(nameRule, { program_name_present: 0 }).passed).toBe(false);
    expect(evaluateRule(nameRule, {}).passed).toBe(false); // missing fact -> fail-safe
    expect(evaluateRule(nameRule, { program_name_present: 1 }).passed).toBe(true);
  });

  it("numeric_min treats a missing fact as a failure (never a silent pass)", () => {
    expect(evaluateRule(refsRule, { verified_references_count: 0 }).passed).toBe(false);
    expect(evaluateRule(refsRule, { verified_references_count: 2 }).passed).toBe(true);
  });

  it("classifies FAILED checks by severity and derives the export gate", () => {
    // Valid structure + name, but no verified references -> one warning failure only.
    const facts = { courses_count: 3, program_name_present: 1, verified_references_count: 0 };
    const results = evaluateRules([coursesRule, nameRule, refsRule], facts);
    const c = classifyFailures(results);

    expect(c.blocking).toHaveLength(0);
    expect(c.warning).toHaveLength(1);
    expect(hasBlockingFailure(results)).toBe(false);
    expect(hasLowQualityFailure(results)).toBe(true);
    expect(exportDecision(results)).toBe("needs_justification");
  });

  it("a blocking failure yields a 'blocked' decision even alongside warnings", () => {
    const facts = { courses_count: 1, program_name_present: 1, verified_references_count: 0 };
    const results = evaluateRules([coursesRule, nameRule, refsRule], facts);
    expect(exportDecision(results)).toBe("blocked");
    expect(classifyFailures(results).blocking[0]!.ruleCode).toBe("COMP-BR-001");
  });

  it("all checks passing -> a clear export decision", () => {
    const facts = { courses_count: 4, program_name_present: 1, verified_references_count: 3 };
    const results = evaluateRules([coursesRule, nameRule, refsRule], facts);
    expect(exportDecision(results)).toBe("clear");
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
