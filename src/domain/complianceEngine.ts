// Compliance rules engine (EP-16 / D-08 / BR-019) — PURE and framework-free so it
// is trivially unit-testable and enforced in CI.
//
// The engine is DATA-DRIVEN: it evaluates a list of rules (loaded from the DB, not
// hard-coded) against a bag of program FACTS, and classifies each outcome as
// blocking / warning / suggestion. The export gate (BR-019) is derived here:
//   - any FAILED blocking check  -> export is blocked (no override).
//   - any FAILED warning/suggestion -> "low quality": export allowed ONLY with a
//     saved justification (enforced by the service layer against the audit log).
//
// Adding or editing a rule ROW of an already-known `ruleType` needs NO code change.

import type { Severity } from "@/domain/businessRules";

export type RuleType = "numeric_min_max" | "numeric_min" | "numeric_max" | "required_present";

// A fact value the engine can read. Numbers for thresholds; presence flags are 1/0.
export type FactValue = number | null;
export type ProgramFacts = Record<string, FactValue>;

export interface EvalRule {
  ruleCode: string;
  severity: Severity;
  ruleType: RuleType;
  factKey: string;
  params: { min?: number; max?: number };
  message: string; // Arabic; "{value}" is replaced with the observed fact
}

export interface CheckResult {
  ruleCode: string;
  severity: Severity;
  passed: boolean;
  factKey: string;
  observed: FactValue;
  message: string; // empty when passed
}

function interpolate(message: string, value: FactValue): string {
  return message.replace("{value}", value === null ? "—" : String(value));
}

// Evaluate one rule against the facts. A missing fact is treated as "not satisfied"
// (null), so a rule referencing an absent fact FAILS rather than silently passing.
export function evaluateRule(rule: EvalRule, facts: ProgramFacts): CheckResult {
  const observed = rule.factKey in facts ? facts[rule.factKey]! : null;
  const passed = ruleHolds(rule, observed);
  return {
    ruleCode: rule.ruleCode,
    severity: rule.severity,
    passed,
    factKey: rule.factKey,
    observed,
    message: passed ? "" : interpolate(rule.message, observed),
  };
}

function ruleHolds(rule: EvalRule, observed: FactValue): boolean {
  const { min, max } = rule.params;
  switch (rule.ruleType) {
    case "required_present":
      // Present and truthy: a presence flag (1) or any positive numeric value.
      return observed !== null && observed > 0;
    case "numeric_min":
      if (observed === null) return false;
      return min === undefined || observed >= min;
    case "numeric_max":
      if (observed === null) return false;
      return max === undefined || observed <= max;
    case "numeric_min_max":
      if (observed === null) return false;
      return (min === undefined || observed >= min) && (max === undefined || observed <= max);
    default:
      // Unknown rule type: fail-safe — do not silently pass an unrecognized rule.
      return false;
  }
}

export function evaluateRules(rules: EvalRule[], facts: ProgramFacts): CheckResult[] {
  return rules.map((r) => evaluateRule(r, facts));
}

export interface Classified {
  blocking: CheckResult[]; // FAILED blocking
  warning: CheckResult[]; // FAILED warning
  suggestion: CheckResult[]; // FAILED suggestion
}

// Classify the FAILED checks by severity (passing checks are not issues).
export function classifyFailures(results: CheckResult[]): Classified {
  const failed = results.filter((r) => !r.passed);
  return {
    blocking: failed.filter((r) => r.severity === "blocking"),
    warning: failed.filter((r) => r.severity === "warning"),
    suggestion: failed.filter((r) => r.severity === "suggestion"),
  };
}

// BR-019 hard gate: a blocking failure prevents export outright.
export function hasBlockingFailure(results: CheckResult[]): boolean {
  return results.some((r) => !r.passed && r.severity === "blocking");
}

// BR-019 soft gate: a warning/suggestion failure is "low quality" — allowed to
// export only with a saved justification.
export function hasLowQualityFailure(results: CheckResult[]): boolean {
  return results.some((r) => !r.passed && r.severity !== "blocking");
}

export type ExportDecision = "blocked" | "needs_justification" | "clear";

// The gate decision from the checks alone (justification handled by the service).
export function exportDecision(results: CheckResult[]): ExportDecision {
  if (hasBlockingFailure(results)) return "blocked";
  if (hasLowQualityFailure(results)) return "needs_justification";
  return "clear";
}
