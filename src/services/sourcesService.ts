// Sources & files service (EP-04). Orchestrates safe upload (SEC-004), private storage
// (SEC-007), program_sources, and the redaction pipeline + redaction_logs (SEC-006).
// Every write is attributed + audited (rule 00 / rule 30).

import { randomUUID } from "node:crypto";
import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  insertUploadedFile,
  insertProgramSource,
  insertRedactionLogs,
  type SourceType,
} from "@/data/sourcesRepo";
import { validateUpload } from "@/domain/uploadValidation";
import { redact, type RedactionEntity } from "@/domain/redaction";
import { type FileStore, SupabaseFileStore } from "@/services/fileStore";
import { defaultMalwareScanner, type MalwareScanner } from "@/services/malwareScan";

export interface UploadInput {
  programId: string;
  file: { originalName: string; declaredMime: string; bytes: Uint8Array };
  sourceType: SourceType;
  notes?: string;
}

export interface UploadResult {
  fileId: string;
  sourceId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

export class InfectedFileError extends Error {
  constructor() {
    super("تم رفض الملف: فحص الفيروسات اكتشف محتوى ضارًا.");
    this.name = "InfectedFileError";
  }
}

function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
}

export async function uploadSource(
  input: UploadInput,
  actor: string,
  deps: { store?: FileStore; scanner?: MalwareScanner } = {},
): Promise<UploadResult> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(input.programId);
  if (!program) throw new Error("uploadSource: program not found");

  const { originalName, declaredMime, bytes } = input.file;
  // 1) Type + real-MIME + size validation (throws on any violation).
  const mimeType = validateUpload(
    { originalName, declaredMime, sizeBytes: bytes.byteLength },
    bytes,
  );

  // 2) Malware scan — reject before anything is stored.
  const scanner = deps.scanner ?? defaultMalwareScanner;
  if ((await scanner.scan(bytes)) === "infected") throw new InfectedFileError();

  // 3) Store in the private bucket.
  const store = deps.store ?? new SupabaseFileStore();
  const storagePath = `programs/${input.programId}/${randomUUID()}-${safeName(originalName)}`;
  await store.put(storagePath, bytes, mimeType);

  // 4) Persist metadata + source row, attributed + audited, in one transaction.
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let fileId = "";
    let sourceId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "source.upload",
        program_id: input.programId,
        new_value: { originalName, mimeType, sizeBytes: bytes.byteLength, storagePath },
      },
      async () => {
        fileId = await insertUploadedFile(client, {
          programId: input.programId,
          storagePath,
          originalName,
          mimeType,
          sizeBytes: bytes.byteLength,
          scanStatus: "clean",
          actor,
        });
        sourceId = await insertProgramSource(client, {
          programId: input.programId,
          sourceType: input.sourceType,
          notes: input.notes ?? null,
          actor,
        });
      },
      sink,
    );
    return { fileId, sourceId, storagePath, mimeType, sizeBytes: bytes.byteLength };
  });
}

export interface RedactionOutcome {
  redactedText: string;
  counts: Record<RedactionEntity, number>;
  total: number;
}

// Redact PII from text bound for the model and log every redaction (SEC-006).
// Returns the cleaned text; callers must use THIS, never the raw text, before any LLM call.
export async function redactAndLog(params: {
  uploadedFileId?: string | null;
  text: string;
  knownNames?: string[];
  actor: string;
}): Promise<RedactionOutcome> {
  if (!params.actor?.trim()) {
    throw new Error("actor_name is required — no anonymous writes (rule 00).");
  }
  const result = redact(params.text, params.knownNames ?? []);

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: params.actor,
        operation_type: "redaction.run",
        new_value: { counts: result.counts, total: result.total },
      },
      async () => {
        await insertRedactionLogs(params.uploadedFileId ?? null, result.counts, client);
      },
      sink,
    );
  });

  return { redactedText: result.text, counts: result.counts, total: result.total };
}
