// Question-bank balance & quality checks (EP-13 / §17 / TC-07). PURE.
// A question NOT linked to a CLO is a WARNING per question AND blocks the bank's balance.
// Coverage, difficulty spread, and distractor checks are quality WARNINGS.

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionForBalance {
  id: string;
  cloId: string | null;
  difficulty: Difficulty | null;
  optionCount: number;
  correctCount: number;
}

export interface QuestionIssue {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  questionId?: string;
}

export interface BalanceReport {
  balanced: boolean; // false when any BLOCKING issue is present
  issues: QuestionIssue[];
}

export function evaluateBalance(
  questions: QuestionForBalance[],
  programCloIds: string[] = [],
): BalanceReport {
  const issues: QuestionIssue[] = [];

  // §17 / TC-07 — unlinked question: warning per question + block the bank balance.
  const unlinked = questions.filter((q) => !q.cloId);
  for (const q of unlinked) {
    issues.push({
      code: "question_unlinked",
      severity: "warning",
      message: "سؤال غير مرتبط بمخرج تعلم (CLO).",
      questionId: q.id,
    });
  }
  if (unlinked.length > 0) {
    issues.push({
      code: "balance_unlinked",
      severity: "blocking",
      message: `تعذّر اعتماد توازن البنك: يوجد ${unlinked.length} سؤال غير مرتبط بمخرج تعلم (§17).`,
    });
  }

  // Coverage — a CLO with no questions is a warning.
  const covered = new Set(questions.filter((q) => q.cloId).map((q) => q.cloId));
  for (const cloId of programCloIds) {
    if (!covered.has(cloId)) {
      issues.push({
        code: "clo_uncovered",
        severity: "warning",
        message: "يوجد مخرج تعلم (CLO) بلا أسئلة.",
      });
    }
  }

  // Difficulty spread — with enough questions, expect at least two difficulty levels.
  const difficulties = new Set(questions.map((q) => q.difficulty).filter(Boolean));
  if (questions.length >= 3 && difficulties.size < 2) {
    issues.push({
      code: "difficulty_skew",
      severity: "warning",
      message: "توزيع الصعوبة غير متوازن (مستوى واحد فقط).",
    });
  }

  // Distractors — an MCQ needs exactly one correct answer and at least one distractor.
  for (const q of questions) {
    if (q.optionCount <= 0) continue;
    if (q.correctCount !== 1) {
      issues.push({
        code: "distractor_no_single_correct",
        severity: "warning",
        message: "يجب أن يكون للسؤال إجابة صحيحة واحدة فقط.",
        questionId: q.id,
      });
    } else if (q.optionCount - q.correctCount < 1) {
      issues.push({
        code: "distractor_missing",
        severity: "warning",
        message: "يجب أن يحتوي السؤال على مشتّت واحد على الأقل.",
        questionId: q.id,
      });
    }
  }

  return { balanced: !issues.some((i) => i.severity === "blocking"), issues };
}
