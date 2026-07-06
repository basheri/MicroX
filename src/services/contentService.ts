// Content & instructional design service (EP-11). Self-paced resources, formative
// activities (BR-009: never counted toward passing), and instructional-design assets.

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import {
  insertResource,
  insertFormativeActivity,
  insertDesignAsset,
  listActivitiesForLesson,
  listActivitiesForProgram,
  listResourcesForLesson,
} from "@/data/contentRepo";

async function audited<T>(
  actor: string,
  op: string,
  meta: Record<string, unknown>,
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let result!: T;
    await withAudit(
      { actor_name: actor, operation_type: op, new_value: meta },
      async () => {
        result = await fn(client);
      },
      sink,
    );
    return result;
  });
}

export function addResource(
  lessonId: string,
  input: { resourceType?: string; title?: string; durationMinutes?: number },
  actor: string,
) {
  return audited(actor, "resource.create", { lessonId, ...input }, (c) =>
    insertResource(c, { lessonId, ...input }),
  );
}

// Add a learning activity. It is ALWAYS formative (BR-009) — the data layer hard-codes
// is_formative = true, so a summative "activity" cannot be created here.
export function addActivity(lessonId: string, input: { title: string }, actor: string) {
  return audited(
    actor,
    "activity.create",
    { lessonId, title: input.title, isFormative: true },
    (c) => insertFormativeActivity(c, { lessonId, title: input.title }),
  );
}

export function addDesignAsset(
  input: { lessonId?: string; resourceId?: string; assetType: string; content?: string },
  actor: string,
) {
  return audited(actor, "design_asset.create", { ...input }, (c) => insertDesignAsset(c, input));
}

export { listActivitiesForLesson, listActivitiesForProgram, listResourcesForLesson };
