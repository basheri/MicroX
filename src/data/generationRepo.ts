// Generation jobs + staged sections data layer (EP-09). generation_jobs drives the
// async progress/cancel lifecycle; generated_sections holds preview-before-apply
// content with pinning. All writes parameterized (SEC-003).

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface GenerationJob {
  id: string;
  program_id: string;
  job_type: string;
  status: JobStatus;
  progress: number;
}

export async function createJob(input: {
  programId: string;
  jobType: string;
  actor: string;
}): Promise<string> {
  const rows = await getPool().query<{ id: string }>(
    `insert into generation_jobs (program_id, job_type, status, progress, created_by_actor)
     values ($1, $2, 'queued', 0, $3) returning id`,
    [input.programId, input.jobType, input.actor],
  );
  return rows.rows[0]!.id;
}

export async function getJob(jobId: string): Promise<GenerationJob | null> {
  const rows = await getPool().query<GenerationJob>(
    "select id, program_id, job_type, status, progress from generation_jobs where id = $1",
    [jobId],
  );
  return rows.rows[0] ?? null;
}

export async function setJobStatus(jobId: string, status: JobStatus): Promise<void> {
  await getPool().query(
    "update generation_jobs set status = $2, updated_at = now() where id = $1",
    [jobId, status],
  );
}

export async function setJobProgress(jobId: string, progress: number): Promise<void> {
  await getPool().query(
    "update generation_jobs set progress = $2, updated_at = now() where id = $1",
    [jobId, Math.max(0, Math.min(100, Math.round(progress)))],
  );
}

export interface GeneratedSection {
  id: string;
  program_id: string;
  section_key: string;
  content: unknown;
  status: "previewed" | "applied" | "discarded";
  is_pinned: boolean;
}

// Upsert the current preview for a (program, section_key). Never sets 'applied'.
export async function upsertSectionPreview(
  client: PoolClient,
  input: { programId: string; jobId: string; sectionKey: string; content: unknown; actor: string },
): Promise<void> {
  await client.query(
    `insert into generated_sections
       (program_id, generation_job_id, section_key, content, status, created_by_actor)
     values ($1, $2, $3, $4, 'previewed', $5)
     on conflict (program_id, section_key) do update
       set content = excluded.content,
           generation_job_id = excluded.generation_job_id,
           status = 'previewed',
           applied_by_actor = null,
           applied_at = null,
           updated_at = now()`,
    [input.programId, input.jobId, input.sectionKey, JSON.stringify(input.content), input.actor],
  );
}

export async function listSections(programId: string): Promise<GeneratedSection[]> {
  return (
    await getPool().query<GeneratedSection>(
      `select id, program_id, section_key, content, status, is_pinned
         from generated_sections where program_id = $1 order by section_key`,
      [programId],
    )
  ).rows;
}

export async function getSection(sectionId: string): Promise<GeneratedSection | null> {
  const rows = await getPool().query<GeneratedSection>(
    "select id, program_id, section_key, content, status, is_pinned from generated_sections where id = $1",
    [sectionId],
  );
  return rows.rows[0] ?? null;
}

export async function applySection(
  client: PoolClient,
  sectionId: string,
  actor: string,
): Promise<boolean> {
  const res = await client.query(
    `update generated_sections
        set status = 'applied', applied_by_actor = $2, applied_at = now(), updated_at = now()
      where id = $1 and status = 'previewed'`,
    [sectionId, actor],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function setSectionPinned(sectionId: string, pinned: boolean): Promise<void> {
  await getPool().query(
    "update generated_sections set is_pinned = $2, updated_at = now() where id = $1",
    [sectionId, pinned],
  );
}

export async function pinnedSectionKeys(programId: string): Promise<Set<string>> {
  const rows = await getPool().query<{ section_key: string }>(
    "select section_key from generated_sections where program_id = $1 and is_pinned = true",
    [programId],
  );
  return new Set(rows.rows.map((r) => r.section_key));
}

export async function countApplied(programId: string): Promise<number> {
  const rows = await getPool().query<{ n: number }>(
    "select count(*)::int as n from generated_sections where program_id = $1 and status = 'applied'",
    [programId],
  );
  return rows.rows[0]!.n;
}
