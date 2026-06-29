// Sources & files data layer (EP-04). Persists uploaded_files, program_sources, and
// the append-only redaction_logs (rule 30). All writes are parameterized (SEC-003).

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import type { RedactionEntity } from "@/domain/redaction";

export type SourceType =
  "from_center" | "from_university" | "align_existing" | "professional_sector";

export interface UploadedFile {
  id: string;
  program_id: string | null;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  scan_status: string;
  is_deleted: boolean;
}

export async function insertUploadedFile(
  client: PoolClient,
  input: {
    programId: string;
    storagePath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    scanStatus: "pending" | "clean" | "infected";
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into uploaded_files
       (program_id, storage_path, original_name, mime_type, size_bytes, scan_status, created_by_actor)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      input.programId,
      input.storagePath,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.scanStatus,
      input.actor,
    ],
  );
  return rows.rows[0]!.id;
}

export async function insertProgramSource(
  client: PoolClient,
  input: { programId: string; sourceType: SourceType; notes?: string | null; actor: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into program_sources (program_id, source_type, notes, created_by_actor)
     values ($1, $2, $3, $4) returning id`,
    [input.programId, input.sourceType, input.notes ?? null, input.actor],
  );
  return rows.rows[0]!.id;
}

// Append redaction counts (one row per non-zero entity type) — never updated/deleted.
export async function insertRedactionLogs(
  uploadedFileId: string | null,
  counts: Record<RedactionEntity, number>,
  client?: PoolClient,
): Promise<void> {
  const runner = client ?? getPool();
  const entries = (Object.entries(counts) as [RedactionEntity, number][]).filter(([, n]) => n > 0);
  for (const [entity, n] of entries) {
    await runner.query(
      `insert into redaction_logs (uploaded_file_id, entity_type, count) values ($1, $2, $3)`,
      [uploadedFileId, entity, n],
    );
  }
}

export interface SourceListItem {
  file_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  scan_status: string;
  storage_path: string;
}

export async function listProgramFiles(programId: string): Promise<SourceListItem[]> {
  const rows = await getPool().query<SourceListItem>(
    `select id as file_id, original_name, mime_type, size_bytes, scan_status, storage_path
       from uploaded_files
      where program_id = $1 and is_deleted = false
      order by created_at desc`,
    [programId],
  );
  return rows.rows;
}

export async function getUploadedFile(fileId: string): Promise<UploadedFile | null> {
  const rows = await getPool().query<UploadedFile>(
    `select id, program_id, storage_path, original_name, mime_type, size_bytes, scan_status, is_deleted
       from uploaded_files where id = $1 and is_deleted = false`,
    [fileId],
  );
  return rows.rows[0] ?? null;
}
