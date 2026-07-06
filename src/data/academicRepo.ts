// Academic structure data layer (EP-10): courses, units, lessons, PLOs, CLOs, and the
// alignment matrix, plus the gap-detector queries. Active (non-deleted) rows only.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export interface Course {
  id: string;
  program_id: string;
  title: string;
  credit_hours: number;
  actual_hours: number;
  order_index: number | null;
}

export async function countActiveCourses(programId: string): Promise<number> {
  const rows = await getPool().query<{ n: number }>(
    "select count(*)::int as n from courses where program_id = $1 and is_deleted = false",
    [programId],
  );
  return rows.rows[0]!.n;
}

export async function sumCreditHours(programId: string): Promise<number> {
  const rows = await getPool().query<{ total: string | null }>(
    "select coalesce(sum(credit_hours), 0) as total from courses where program_id = $1 and is_deleted = false",
    [programId],
  );
  return Number(rows.rows[0]!.total);
}

export async function insertCourse(
  client: PoolClient,
  input: {
    programId: string;
    title: string;
    creditHours: number;
    actualHours: number;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into courses (program_id, title, credit_hours, actual_hours,
       order_index, created_at, updated_at)
     values ($1, $2, $3, $4,
       (select coalesce(max(order_index), 0) + 1 from courses where program_id = $1), now(), now())
     returning id`,
    [input.programId, input.title, input.creditHours, input.actualHours],
  );
  return rows.rows[0]!.id;
}

export async function updateCourse(
  client: PoolClient,
  courseId: string,
  input: { title?: string; creditHours?: number; actualHours?: number },
): Promise<void> {
  await client.query(
    `update courses set
       title = coalesce($2, title),
       credit_hours = coalesce($3, credit_hours),
       actual_hours = coalesce($4, actual_hours),
       updated_at = now()
     where id = $1`,
    [courseId, input.title ?? null, input.creditHours ?? null, input.actualHours ?? null],
  );
}

export async function softDeleteCourse(client: PoolClient, courseId: string): Promise<void> {
  await client.query("update courses set is_deleted = true where id = $1", [courseId]);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const rows = await getPool().query<Course>(
    "select id, program_id, title, credit_hours::float as credit_hours, actual_hours::float as actual_hours, order_index from courses where id = $1 and is_deleted = false",
    [courseId],
  );
  return rows.rows[0] ?? null;
}

export async function listCourses(programId: string): Promise<Course[]> {
  return (
    await getPool().query<Course>(
      "select id, program_id, title, credit_hours::float as credit_hours, actual_hours::float as actual_hours, order_index from courses where program_id = $1 and is_deleted = false order by order_index",
      [programId],
    )
  ).rows;
}

// --- Outcomes ---
export async function insertPLO(
  client: PoolClient,
  input: { programId: string; statement: string; bloomVerb?: string | null },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into program_learning_outcomes (program_id, statement, bloom_verb) values ($1, $2, $3) returning id",
    [input.programId, input.statement, input.bloomVerb ?? null],
  );
  return rows.rows[0]!.id;
}

export async function insertCLO(
  client: PoolClient,
  input: { courseId: string; statement: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into course_learning_outcomes (course_id, statement) values ($1, $2) returning id",
    [input.courseId, input.statement],
  );
  return rows.rows[0]!.id;
}

export async function insertUnit(
  client: PoolClient,
  input: { courseId: string; title: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into course_units (course_id, title) values ($1, $2) returning id",
    [input.courseId, input.title],
  );
  return rows.rows[0]!.id;
}

export async function insertLesson(
  client: PoolClient,
  input: {
    unitId: string;
    title: string;
    objective?: string | null;
    durationMinutes?: number | null;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into lessons (unit_id, title, objective, duration_minutes) values ($1, $2, $3, $4) returning id",
    [input.unitId, input.title, input.objective ?? null, input.durationMinutes ?? null],
  );
  return rows.rows[0]!.id;
}

// --- Alignment matrix ---
export interface AlignmentLink {
  competencyId?: string | null;
  ploId?: string | null;
  cloId?: string | null;
  unitId?: string | null;
  questionId?: string | null;
}

export async function insertAlignment(
  client: PoolClient,
  programId: string,
  link: AlignmentLink,
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into alignment_matrix (program_id, competency_id, plo_id, clo_id, unit_id, question_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      programId,
      link.competencyId ?? null,
      link.ploId ?? null,
      link.cloId ?? null,
      link.unitId ?? null,
      link.questionId ?? null,
    ],
  );
  return rows.rows[0]!.id;
}

export async function listAlignment(programId: string) {
  return (
    await getPool().query(
      "select id, competency_id, plo_id, clo_id, unit_id, question_id from alignment_matrix where program_id = $1",
      [programId],
    )
  ).rows;
}

// --- Gap detectors (TC-06) ---
// PLOs not referenced by any alignment row (uncovered outcomes).
export async function uncoveredPLOs(programId: string) {
  return (
    await getPool().query<{ id: string; statement: string }>(
      `select p.id, p.statement from program_learning_outcomes p
        where p.program_id = $1 and p.is_deleted = false
          and not exists (select 1 from alignment_matrix a where a.plo_id = p.id)`,
      [programId],
    )
  ).rows;
}

// CLOs not referenced by any alignment row.
export async function uncoveredCLOs(programId: string) {
  return (
    await getPool().query<{ id: string; statement: string }>(
      `select c.id, c.statement from course_learning_outcomes c
         join courses co on co.id = c.course_id
        where co.program_id = $1 and c.is_deleted = false
          and not exists (select 1 from alignment_matrix a where a.clo_id = c.id)`,
      [programId],
    )
  ).rows;
}

// Units (content) not linked to any outcome via the alignment matrix.
export async function contentWithoutOutcome(programId: string) {
  return (
    await getPool().query<{ id: string; title: string }>(
      `select u.id, u.title from course_units u
         join courses co on co.id = u.course_id
        where co.program_id = $1 and u.is_deleted = false
          and not exists (
            select 1 from alignment_matrix a
             where a.unit_id = u.id and (a.clo_id is not null or a.plo_id is not null)
          )`,
      [programId],
    )
  ).rows;
}
