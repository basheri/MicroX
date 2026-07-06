// Question bank data layer (EP-13): question_banks, questions, question_options.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import type { QuestionForBalance } from "@/domain/questionBalance";

export async function createBank(
  client: PoolClient,
  input: { programId: string; title: string; actor: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into question_banks (program_id, title, created_at) values ($1, $2, now()) returning id",
    [input.programId, input.title],
  );
  return rows.rows[0]!.id;
}

export async function getBankProgram(bankId: string): Promise<string | null> {
  const rows = await getPool().query<{ program_id: string }>(
    "select program_id from question_banks where id = $1 and is_deleted = false",
    [bankId],
  );
  return rows.rows[0]?.program_id ?? null;
}

export interface NewQuestion {
  cloId?: string | null;
  courseId?: string | null;
  unitId?: string | null;
  stem: string;
  qtype: string;
  correctAnswer?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  topic?: string | null;
  options?: { text: string; isCorrect: boolean }[];
}

export async function insertQuestion(
  client: PoolClient,
  bankId: string,
  q: NewQuestion,
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into questions
       (question_bank_id, clo_id, course_id, unit_id, stem, qtype, correct_answer, difficulty, topic, review_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft') returning id`,
    [
      bankId,
      q.cloId ?? null,
      q.courseId ?? null,
      q.unitId ?? null,
      q.stem,
      q.qtype,
      q.correctAnswer ?? null,
      q.difficulty ?? null,
      q.topic ?? null,
    ],
  );
  const questionId = rows.rows[0]!.id;
  for (const opt of q.options ?? []) {
    await client.query(
      "insert into question_options (question_id, option_text, is_correct) values ($1, $2, $3)",
      [questionId, opt.text, opt.isCorrect],
    );
  }
  return questionId;
}

// Questions with option/correct counts, for the balance evaluation.
export async function listQuestionsForBalance(bankId: string): Promise<QuestionForBalance[]> {
  const rows = await getPool().query<{
    id: string;
    clo_id: string | null;
    difficulty: "easy" | "medium" | "hard" | null;
    option_count: number;
    correct_count: number;
  }>(
    `select q.id, q.clo_id, q.difficulty,
            (select count(*) from question_options o where o.question_id = q.id)::int as option_count,
            (select count(*) from question_options o where o.question_id = q.id and o.is_correct)::int as correct_count
       from questions q
      where q.question_bank_id = $1 and q.is_deleted = false
      order by q.id`,
    [bankId],
  );
  return rows.rows.map((r) => ({
    id: r.id,
    cloId: r.clo_id,
    difficulty: r.difficulty,
    optionCount: r.option_count,
    correctCount: r.correct_count,
  }));
}

// Active CLO ids across a program (for coverage).
export async function listProgramCloIds(programId: string): Promise<string[]> {
  const rows = await getPool().query<{ id: string }>(
    `select c.id from course_learning_outcomes c
       join courses co on co.id = c.course_id
      where co.program_id = $1 and c.is_deleted = false`,
    [programId],
  );
  return rows.rows.map((r) => r.id);
}
