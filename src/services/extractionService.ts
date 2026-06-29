// Extraction service (EP-05). Runs the right extractor for a file's type, stores blocks
// with page/location/confidence (attributed + audited), supports human review, and
// exposes ONLY gate-cleared content to downstream consumers (RAG/generation, EP-07).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getUploadedFile } from "@/data/sourcesRepo";
import {
  insertExtractedBlock,
  insertExtractionReview,
  listExtraction,
  getUsableExtraction,
  countBlockingLowConfidence,
} from "@/data/extractionRepo";
import { OfficeExtractor } from "@/services/extraction/officeExtractor";
import type { ExtractedBlock, OcrEngine } from "@/services/extraction/types";
import { isLowConfidence, type ReviewStatus } from "@/domain/extractionGate";
import { type FileStore, SupabaseFileStore } from "@/services/fileStore";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

export class OcrNotConfiguredError extends Error {
  constructor() {
    super("استخراج ملفات PDF الممسوحة يتطلب محرك OCR (غير مُهيأ بعد).");
    this.name = "OcrNotConfiguredError";
  }
}

export interface ExtractionSummary {
  fileId: string;
  blocks: number;
  lowConfidence: number;
}

// Extract a file's content into extracted_file_content. Office types use the real
// OfficeExtractor; scanned PDFs require an injected OCR engine (deps.ocrEngine).
export async function extractFile(
  uploadedFileId: string,
  bytes: Uint8Array,
  actor: string,
  deps: { ocrEngine?: OcrEngine } = {},
): Promise<ExtractionSummary> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const file = await getUploadedFile(uploadedFileId);
  if (!file) throw new Error("extractFile: uploaded file not found");

  let blocks: ExtractedBlock[];
  if (file.mime_type === DOCX_MIME || file.mime_type === XLSX_MIME) {
    blocks = await new OfficeExtractor().extract({ bytes, mimeType: file.mime_type });
  } else if (file.mime_type === PDF_MIME) {
    if (!deps.ocrEngine) throw new OcrNotConfiguredError();
    blocks = await deps.ocrEngine.recognize(bytes);
  } else {
    blocks = [];
  }

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "extraction.run",
        new_value: { uploadedFileId, blocks: blocks.length },
      },
      async () => {
        for (const block of blocks) {
          await insertExtractedBlock(client, uploadedFileId, block);
        }
      },
      sink,
    );
  });

  return {
    fileId: uploadedFileId,
    blocks: blocks.length,
    lowConfidence: blocks.filter((b) => isLowConfidence(b.confidence)).length,
  };
}

// Human-in-the-loop review of one extracted block (AI-006). Approving/correcting a
// low-confidence block clears it for downstream use; rejecting keeps it out.
export async function reviewExtraction(
  extractedContentId: string,
  input: { status: Exclude<ReviewStatus, null>; correctedContent?: string | null },
  actor: string,
): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "extraction.review",
        new_value: { extractedContentId, status: input.status },
      },
      async () => {
        await insertExtractionReview(client, {
          extractedContentId,
          status: input.status,
          correctedContent: input.correctedContent ?? null,
          actor,
        });
      },
      sink,
    );
  });
}

// Convenience: download the file's bytes from storage, then extract (used by the API).
export async function extractStoredFile(
  uploadedFileId: string,
  actor: string,
  deps: { store?: FileStore; ocrEngine?: OcrEngine } = {},
): Promise<ExtractionSummary> {
  const file = await getUploadedFile(uploadedFileId);
  if (!file) throw new Error("extractStoredFile: uploaded file not found");
  const store = deps.store ?? new SupabaseFileStore();
  const bytes = await store.download(file.storage_path);
  return extractFile(uploadedFileId, bytes, actor, { ocrEngine: deps.ocrEngine });
}

export { listExtraction, getUsableExtraction };

// Downstream guard (TC-09): true while any low-confidence block is still unreviewed.
export async function isExtractionBlocked(uploadedFileId: string): Promise<boolean> {
  return (await countBlockingLowConfidence(uploadedFileId)) > 0;
}
