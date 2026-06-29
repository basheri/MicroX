import { describe, it } from "vitest";

// Placeholder home for the CI guardrails mandated by rule 70-testing-and-quality-gates:
// the business-rule boundary cases (TC-01..14) and the "no HTML -> Word" rule must
// FAIL the build when violated. These are implemented in the epics that own each rule
// (courses EP-10, hours EP-12, question bank EP-13, Word engine EP-15, compliance
// EP-16) and consolidated in EP-22. Marked `.todo` so they show as pending — not as
// passing coverage — and never invent thresholds beyond rule 10-business-rules.md.
describe("CI guardrails (implemented per-epic; consolidated in EP-22)", () => {
  it.todo("TC-01 BR-001: program with <2 or >6 courses is blocked");
  it.todo("TC-02 BR-002: total credit hours <3 or >23 is blocked");
  it.todo("TC-03 BR-003: course credit hours <1 or >10 is blocked");
  it.todo("TC-04 BR-005: weekly load >15 actual hours is blocked");
  it.todo("TC-05 BR-006: course hours != credits*15 is blocked + recomputed");
  it.todo("TC-08 BR-013: official template missing required fields blocks export");
  it.todo("TC-11 BR-019: export with a blocking error is prevented");
  it.todo("TC-13 BR-020: editing a published version is blocked");
  it.todo("no-HTML->Word: Word output must fill the original template, never HTML");
});
