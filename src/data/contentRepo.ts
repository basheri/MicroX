// Content & instructional design data layer (EP-11): learning_resources,
// learning_activities (formative-only), instructional_design_assets. Active rows only.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export async function insertResource(
  client: PoolClient,
  input: {
    lessonId: string;
    resourceType?: string | null;
    title?: string | null;
    durationMinutes?: number | null;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into learning_resources (lesson_id, resource_type, title, duration_minutes) values ($1, $2, $3, $4) returning id",
    [
      input.lessonId,
      input.resourceType ?? null,
      input.title ?? null,
      input.durationMinutes ?? null,
    ],
  );
  return rows.rows[0]!.id;
}

// Activities are ALWAYS formative (BR-009): is_formative is hard-coded true here, so no
// activity can ever be created as summative.
export async function insertFormativeActivity(
  client: PoolClient,
  input: { lessonId: string; title: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into learning_activities (lesson_id, title, is_formative) values ($1, $2, true) returning id",
    [input.lessonId, input.title],
  );
  return rows.rows[0]!.id;
}

export async function insertDesignAsset(
  client: PoolClient,
  input: {
    lessonId?: string | null;
    resourceId?: string | null;
    assetType: string;
    content?: string | null;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into instructional_design_assets (lesson_id, resource_id, asset_type, content) values ($1, $2, $3, $4) returning id",
    [input.lessonId ?? null, input.resourceId ?? null, input.assetType, input.content ?? null],
  );
  return rows.rows[0]!.id;
}

export interface ActivityRow {
  id: string;
  lesson_id: string;
  title: string | null;
  is_formative: boolean;
}

export async function listActivitiesForLesson(lessonId: string): Promise<ActivityRow[]> {
  return (
    await getPool().query<ActivityRow>(
      "select id, lesson_id, title, is_formative from learning_activities where lesson_id = $1 and is_deleted = false order by id",
      [lessonId],
    )
  ).rows;
}

// All activities in a program (via lessons -> units -> courses).
export async function listActivitiesForProgram(programId: string): Promise<ActivityRow[]> {
  return (
    await getPool().query<ActivityRow>(
      `select a.id, a.lesson_id, a.title, a.is_formative
         from learning_activities a
         join lessons l on l.id = a.lesson_id
         join course_units u on u.id = l.unit_id
         join courses c on c.id = u.course_id
        where c.program_id = $1 and a.is_deleted = false
        order by a.id`,
      [programId],
    )
  ).rows;
}

export async function listResourcesForLesson(lessonId: string) {
  return (
    await getPool().query(
      "select id, resource_type, title, duration_minutes from learning_resources where lesson_id = $1 and is_deleted = false order by id",
      [lessonId],
    )
  ).rows;
}
