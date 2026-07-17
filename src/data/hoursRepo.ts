// Hours & scheduling data layer (EP-12): hour_allocations + program_schedules.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export interface HourAllocationInput {
  unitId?: string | null;
  hours: number;
  category?: string | null;
}

// Replace a course's hour allocations wholesale (recompute semantics).
export async function replaceHourAllocations(
  client: PoolClient,
  courseId: string,
  allocations: HourAllocationInput[],
): Promise<void> {
  await client.query("delete from hour_allocations where course_id = $1", [courseId]);
  for (const a of allocations) {
    await client.query(
      "insert into hour_allocations (course_id, unit_id, hours, category) values ($1, $2, $3, $4)",
      [courseId, a.unitId ?? null, a.hours, a.category ?? null],
    );
  }
}

export async function listHourAllocations(courseId: string) {
  return (
    await getPool().query(
      "select id, unit_id, hours::float as hours, category from hour_allocations where course_id = $1 order by id",
      [courseId],
    )
  ).rows;
}

// Sum of a program's course actual_hours (= sum credits × 15 when courses are consistent).
export async function sumCourseActualHours(programId: string): Promise<number> {
  const rows = await getPool().query<{ total: string | null }>(
    "select coalesce(sum(actual_hours), 0) as total from courses where program_id = $1 and is_deleted = false",
    [programId],
  );
  return Number(rows.rows[0]!.total);
}

export interface ScheduleRow {
  program_id: string;
  total_credit: number | null;
  total_actual: number | null;
  weeks: number | null;
  weekly_load: number | null;
}

export async function getSchedule(programId: string): Promise<ScheduleRow | null> {
  const rows = await getPool().query<ScheduleRow>(
    `select program_id, total_credit::float as total_credit, total_actual::float as total_actual,
            weeks, weekly_load::float as weekly_load
       from program_schedules where program_id = $1 order by created_at desc limit 1`,
    [programId],
  );
  return rows.rows[0] ?? null;
}

// Upsert the single current schedule row for a program.
export async function upsertSchedule(
  client: PoolClient,
  input: {
    programId: string;
    totalCredit: number;
    totalActual: number;
    weeks: number;
    weeklyLoad: number;
  },
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    "select id from program_schedules where program_id = $1 order by created_at desc limit 1",
    [input.programId],
  );
  const id = existing.rows[0]?.id;
  if (id) {
    await client.query(
      "update program_schedules set total_credit=$2, total_actual=$3, weeks=$4, weekly_load=$5 where id=$1",
      [id, input.totalCredit, input.totalActual, input.weeks, input.weeklyLoad],
    );
  } else {
    await client.query(
      "insert into program_schedules (program_id, total_credit, total_actual, weeks, weekly_load) values ($1,$2,$3,$4,$5)",
      [input.programId, input.totalCredit, input.totalActual, input.weeks, input.weeklyLoad],
    );
  }
}
