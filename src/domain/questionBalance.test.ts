import { describe, it, expect } from "vitest";
import { evaluateBalance, type QuestionForBalance } from "@/domain/questionBalance";

const q = (over: Partial<QuestionForBalance>): QuestionForBalance => ({
  id: "q",
  cloId: "clo1",
  difficulty: "medium",
  optionCount: 4,
  correctCount: 1,
  ...over,
});

// TC-07 — unlinked question: warning + balance block.
describe("question balance (TC-07 / §17)", () => {
  it("flags an unlinked question AND blocks the bank balance", () => {
    const report = evaluateBalance([q({ id: "q1", cloId: null })], ["clo1"]);
    expect(report.balanced).toBe(false); // balance blocked
    expect(
      report.issues.some((i) => i.code === "question_unlinked" && i.severity === "warning"),
    ).toBe(true);
    expect(
      report.issues.some((i) => i.code === "balance_unlinked" && i.severity === "blocking"),
    ).toBe(true);
  });

  it("is balanced when every question is linked and options are valid", () => {
    const report = evaluateBalance(
      [
        q({ id: "q1", cloId: "clo1", difficulty: "easy" }),
        q({ id: "q2", cloId: "clo1", difficulty: "hard" }),
      ],
      ["clo1"],
    );
    expect(report.balanced).toBe(true);
    expect(report.issues.filter((i) => i.severity === "blocking")).toHaveLength(0);
  });

  it("warns (not blocks) on uncovered CLO, difficulty skew, and bad distractors", () => {
    const report = evaluateBalance(
      [
        q({ id: "q1", difficulty: "easy" }),
        q({ id: "q2", difficulty: "easy" }),
        q({ id: "q3", difficulty: "easy", correctCount: 0 }), // no correct answer
      ],
      ["clo1", "clo2"], // clo2 uncovered
    );
    expect(report.balanced).toBe(true); // warnings only
    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain("clo_uncovered");
    expect(codes).toContain("difficulty_skew");
    expect(codes).toContain("distractor_no_single_correct");
  });
});
