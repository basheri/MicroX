// Question bank service (EP-13). Create banks, add/generate questions linked to CLOs,
// and evaluate balance — an unlinked question warns AND blocks the bank balance (TC-07).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  createBank,
  getBankProgram,
  insertQuestion,
  listQuestionsForBalance,
  listProgramCloIds,
  type NewQuestion,
} from "@/data/questionRepo";
import { evaluateBalance, type BalanceReport } from "@/domain/questionBalance";
import { generateStructured } from "@/services/ragService";
import type { LLMProvider } from "@/services/llm/types";

export async function createQuestionBank(
  programId: string,
  title: string,
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("createQuestionBank: program not found");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let bankId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "question_bank.create",
        program_id: programId,
        new_value: { title },
      },
      async () => {
        bankId = await createBank(client, { programId, title, actor });
      },
      sink,
    );
    return bankId;
  });
}

export async function addQuestion(
  bankId: string,
  question: NewQuestion,
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let questionId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "question.create",
        section_ref: bankId,
        new_value: {
          stem: question.stem,
          cloId: question.cloId ?? null,
          difficulty: question.difficulty,
        },
      },
      async () => {
        questionId = await insertQuestion(client, bankId, question);
      },
      sink,
    );
    return questionId;
  });
}

const QUESTIONS_SCHEMA = {
  type: "object",
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        required: ["stem", "cloId", "difficulty", "options"],
        properties: {
          stem: { type: "string" },
          cloId: { type: "string" },
          difficulty: { enum: ["easy", "medium", "hard"] },
          options: {
            type: "array",
            items: {
              type: "object",
              required: ["text", "isCorrect"],
              properties: { text: { type: "string" }, isCorrect: { type: "boolean" } },
            },
          },
        },
      },
    },
  },
} as const;

interface GeneratedQuestions {
  questions: {
    stem: string;
    cloId: string;
    difficulty: "easy" | "medium" | "hard";
    options: { text: string; isCorrect: boolean }[];
  }[];
}

// Balanced generation: produce MCQs linked to CLOs (schema-constrained, mock in tests).
export async function generateQuestions(
  bankId: string,
  actor: string,
  providerOverride?: LLMProvider,
): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const programId = await getBankProgram(bankId);
  if (!programId) throw new Error("generateQuestions: bank not found");

  const { data } = await generateStructured<GeneratedQuestions>(
    {
      messages: [
        {
          role: "system",
          content: "ولّد أسئلة اختيار من متعدد مرتبطة بمخرجات التعلم، بصيغة JSON مطابقة للمخطط.",
        },
        { role: "user", content: `أنشئ بنك أسئلة متوازنًا للبرنامج ${programId}.` },
      ],
      schema: QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
      programId,
    },
    providerOverride,
  );

  let count = 0;
  for (const q of data.questions) {
    await addQuestion(
      bankId,
      {
        cloId: q.cloId,
        stem: q.stem,
        qtype: "mcq",
        difficulty: q.difficulty,
        options: q.options,
        correctAnswer: q.options.find((o) => o.isCorrect)?.text ?? null,
      },
      actor,
    );
    count += 1;
  }
  return count;
}

// Evaluate the bank's balance (TC-07): unlinked questions warn + block balance.
export async function evaluateBankBalance(bankId: string): Promise<BalanceReport> {
  const programId = await getBankProgram(bankId);
  if (!programId) throw new Error("evaluateBankBalance: bank not found");
  const [questions, cloIds] = await Promise.all([
    listQuestionsForBalance(bankId),
    listProgramCloIds(programId),
  ]);
  return evaluateBalance(questions, cloIds);
}
