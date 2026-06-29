// Extraction data layer (EP-05). Persists extracted_file_content + extraction_reviews
// and enforces the confidence gate (TC-09) at query time: downstream consumers only ever
// receive content that is high-confidence OR has been approved/corrected by a human.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import type { ExtractedBlock } from "@/services/extraction/types";
import { LOW_CONFIDENCE_THRESHOLD, type ReviewStatus } from "@/domain/extractionGate";

export async function insertExtractedBlock(
  client: PoolClient,
  uploadedFileId: string,
  block: ExtractedBlock,
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into extracted_file_content
       (uploaded_file_id, page_no, bbox, content, source_class, confidence)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [uploadedFileId, block.pageNo, block.bbox, block.content, block.sourceClass, block.confidence],
  );
  return rows.rows[0]!.id;
}

export async function insertExtractionReview(
  client: PoolClient,
  input: {
    extractedContentId: string;
    status: Exclude<ReviewStatus, null>;
    correctedContent?: string | null;
    actor: string;
  },
): Promise<void> {
  await client.query(
    `insert into extraction_reviews
       (extracted_content_id, status, corrected_content, reviewed_by_actor)
     values ($1, $2, $3, $4)`,
    [input.extractedContentId, input.status, input.correctedContent ?? null, input.actor],
  );
}

export interface ExtractionRow {
  id: string;
  page_no: number | null;
  bbox: string | null;
  content: string;
  source_class: string | null;
  confidence: number | null;
  review_status: ReviewStatus;
  corrected_content: string | null;
  usable: boolean;
  needs_review: boolean;
}

// All blocks for a file with their LATEST review status and computed gate flags.
export async function listExtraction(uploadedFileId: string): Promise<ExtractionRow[]> {
  const rows = await getPool().query<ExtractionRow>(
    `select e.id, e.page_no, e.bbox, e.content, e.source_class, e.confidence,
            r.status as review_status, r.corrected_content,
            (r.status in ('approved','corrected')
              or (r.status is null and e.confidence >= $2)) as usable,
            (r.status is null and e.confidence < $2) as needs_review
       from extracted_file_content e
       left join lateral (
         select status, corrected_content from extraction_reviews
          where extracted_content_id = e.id order by created_at desc limit 1
       ) r on true
      where e.uploaded_file_id = $1
      order by e.created_at asc`,
    [uploadedFileId, LOW_CONFIDENCE_THRESHOLD],
  );
  return rows.rows;
}

// Downstream-usable content ONLY (the gate). Low-confidence + unreviewed and rejected
// blocks are excluded; corrected content overrides the original text.
export async function getUsableExtraction(
  uploadedFileId: string,
): Promise<{ id: string; content: string; sourceClass: string | null }[]> {
  const rows = await getPool().query<{ id: string; content: string; source_class: string | null }>(
    `select e.id,
            case when r.status = 'corrected' and r.corrected_content is not null
                 then r.corrected_content else e.content end as content,
            e.source_class
       from extracted_file_content e
       left join lateral (
         select status, corrected_content from extraction_reviews
          where extracted_content_id = e.id order by created_at desc limit 1
       ) r on true
      where e.uploaded_file_id = $1
        and ( r.status in ('approved','corrected')
              or (r.status is null and e.confidence >= $2) )
      order by e.created_at asc`,
    [uploadedFileId, LOW_CONFIDENCE_THRESHOLD],
  );
  return rows.rows.map((r) => ({ id: r.id, content: r.content, sourceClass: r.source_class }));
}

// True when at least one block is low-confidence and still unreviewed -> not ready for use.
export async function countBlockingLowConfidence(uploadedFileId: string): Promise<number> {
  const rows = await getPool().query<{ n: number }>(
    `select count(*)::int as n
       from extracted_file_content e
       left join lateral (
         select status from extraction_reviews
          where extracted_content_id = e.id order by created_at desc limit 1
       ) r on true
      where e.uploaded_file_id = $1 and r.status is null and e.confidence < $2`,
    [uploadedFileId, LOW_CONFIDENCE_THRESHOLD],
  );
  return rows.rows[0]!.n;
}
