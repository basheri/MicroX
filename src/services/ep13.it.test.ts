// @vitest-environment node
//
// EP-13 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// questions generated + linked to CLOs; an unlinked question warns AND blocks the bank
// balance (TC-07). No live OpenRouter calls.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse, addCLO } from "@/services/academicService";
import {
  createQuestionBank,
  addQuestion,
  generateQuestions,
  evaluateBankBalance,
} from "@/services/questionBankService";
import type { CompletionResult, LLMProvider } from "@/services/llm/types";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

class JsonProvider implements LLMProvider {
  readonly modelId = "mock/model";
  constructor(private readonly out: string) {}
  async complete(): Promise<CompletionResult> {
    return {
      content: this.out,
      model: this.modelId,
      usage: { tokensIn: 3, tokensOut: 2, costUsd: 0 },
    };
  }
  async testConnection() {
    return { ok: true, message: "ok" };
  }
}

const mcq = (isCorrectIndex: number) =>
  ["أ", "ب", "ج", "د"].map((t, i) => ({ text: t, isCorrect: i === isCorrectIndex }));

suite("EP-13 — question bank (integration)", () => {
  let db: IsolatedDb;
  let programId: string;
  let cloId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep13");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (await createProgram({ name: "برنامج الأسئلة", sectorId, fieldId }, "منى")).id;
    const courseId = await addCourse(programId, { title: "مقرر", creditHours: 3 }, "منى");
    cloId = await addCLO(courseId, "يطبّق المفاهيم", "منى");
  });
  afterAll(async () => {
    await db?.teardown();
  });

  // TC-07 — the required proof.
  it("TC-07: an unlinked question is flagged and blocks the bank balance; linking clears the block", async () => {
    const bankId = await createQuestionBank(programId, "بنك 1", "منى");

    // A linked, well-formed question -> balanced.
    await addQuestion(
      bankId,
      { stem: "سؤال مرتبط", qtype: "mcq", cloId, difficulty: "easy", options: mcq(0) },
      "منى",
    );
    let report = await evaluateBankBalance(bankId);
    expect(report.balanced).toBe(true);

    // Add an UNLINKED question (no CLO) -> warning + balance blocked.
    const unlinkedId = await addQuestion(
      bankId,
      { stem: "سؤال غير مرتبط", qtype: "mcq", cloId: null, difficulty: "hard", options: mcq(1) },
      "منى",
    );
    report = await evaluateBankBalance(bankId);
    expect(report.balanced).toBe(false); // blocked by the unlinked question
    expect(
      report.issues.some((i) => i.code === "question_unlinked" && i.questionId === unlinkedId),
    ).toBe(true);
    expect(
      report.issues.some((i) => i.code === "balance_unlinked" && i.severity === "blocking"),
    ).toBe(true);

    // Link it to the CLO -> balance restored.
    await getPool().query("update questions set clo_id = $1 where id = $2", [cloId, unlinkedId]);
    report = await evaluateBankBalance(bankId);
    expect(report.balanced).toBe(true);
  });

  it("generates questions linked to CLOs via the LLM (schema-constrained, mock provider)", async () => {
    const bankId = await createQuestionBank(programId, "بنك 2", "منى");
    const provider = new JsonProvider(
      JSON.stringify({
        questions: [
          { stem: "س1", cloId, difficulty: "easy", options: mcq(0) },
          { stem: "س2", cloId, difficulty: "medium", options: mcq(2) },
          { stem: "س3", cloId, difficulty: "hard", options: mcq(1) },
        ],
      }),
    );
    const n = await generateQuestions(bankId, "منى", provider);
    expect(n).toBe(3);

    const report = await evaluateBankBalance(bankId);
    expect(report.balanced).toBe(true); // all linked, spread across difficulties

    const rows = await getPool().query(
      "select count(*)::int c from questions where question_bank_id=$1 and clo_id is not null",
      [bankId],
    );
    expect(rows.rows[0].c).toBe(3);
  });

  it("refuses anonymous question creation (rule 00)", async () => {
    const bankId = await createQuestionBank(programId, "بنك 3", "منى");
    await expect(addQuestion(bankId, { stem: "x", qtype: "mcq" }, "")).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
