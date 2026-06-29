// @vitest-environment node
//
// EP-05 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// extraction stored with confidence, AND the TC-09 gate — low-confidence content cannot
// be consumed downstream until a human approves/corrects it.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { uploadSource } from "@/services/sourcesService";
import { InMemoryFileStore } from "@/services/fileStore";
import {
  extractFile,
  reviewExtraction,
  listExtraction,
  getUsableExtraction,
  isExtractionBlocked,
} from "@/services/extractionService";
import type { ExtractedBlock, OcrEngine } from "@/services/extraction/types";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF", "latin1"));

function docxBytes(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  return zipSync({
    "word/document.xml": strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>${body}</w:body></w:document>`,
    ),
  });
}

// Fake OCR engine: scanned PDFs are where low-confidence blocks come from.
const fakeOcr = (blocks: ExtractedBlock[]): OcrEngine => ({ recognize: async () => blocks });

suite("EP-05 — OCR & extraction (integration)", () => {
  let db: IsolatedDb;
  let store: InMemoryFileStore;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep05");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    store = new InMemoryFileStore();
    const sector = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const field = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (
      await createProgram({ name: "برنامج الاستخراج", sectorId: sector, fieldId: field }, "منى")
    ).id;
  });

  afterAll(async () => {
    await db?.teardown();
  });

  async function uploadDocx(): Promise<string> {
    const res = await uploadSource(
      {
        programId,
        file: {
          originalName: "doc.docx",
          declaredMime: DOCX_MIME,
          bytes: docxBytes(["فقرة أولى", "فقرة ثانية"]),
        },
        sourceType: "from_center",
      },
      "منى",
      { store },
    );
    return res.fileId;
  }

  async function uploadPdf(): Promise<string> {
    const res = await uploadSource(
      {
        programId,
        file: { originalName: "scan.pdf", declaredMime: "application/pdf", bytes: PDF },
        sourceType: "from_center",
      },
      "منى",
      { store },
    );
    return res.fileId;
  }

  it("extracts DOCX text into extracted_file_content with confidence", async () => {
    const fileId = await uploadDocx();
    const summary = await extractFile(fileId, docxBytes(["فقرة أولى", "فقرة ثانية"]), "منى");
    expect(summary.blocks).toBe(2);

    const rows = await listExtraction(fileId);
    expect(rows).toHaveLength(2);
    expect(Number(rows[0]!.confidence)).toBe(1);
    expect(rows.every((r) => r.usable)).toBe(true); // high confidence -> usable without review

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='extraction.run'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("TC-09: low-confidence content is blocked downstream until approved/corrected", async () => {
    const fileId = await uploadPdf();
    await extractFile(fileId, PDF, "منى", {
      ocrEngine: fakeOcr([
        {
          pageNo: 1,
          bbox: "10,10,100,20",
          content: "عنوان واضح",
          sourceClass: "ocr",
          confidence: 0.95,
        },
        {
          pageNo: 1,
          bbox: "10,40,100,20",
          content: "نص ضبابي",
          sourceClass: "ocr",
          confidence: 0.4,
        },
        {
          pageNo: 2,
          bbox: "10,10,100,20",
          content: "نص ضبابي آخر",
          sourceClass: "ocr",
          confidence: 0.3,
        },
      ]),
    });

    // Initially only the high-confidence block is usable; the file is blocked.
    let usable = await getUsableExtraction(fileId);
    expect(usable.map((u) => u.content)).toEqual(["عنوان واضح"]);
    expect(await isExtractionBlocked(fileId)).toBe(true);

    const rows = await listExtraction(fileId);
    const low = rows.filter((r) => Number(r.confidence) < 0.7);
    expect(low).toHaveLength(2);
    expect(low.every((r) => r.needs_review)).toBe(true);

    // Approve one low block -> it becomes usable, but the file is still blocked by the other.
    await reviewExtraction(low[0]!.id, { status: "approved" }, "سارة");
    usable = await getUsableExtraction(fileId);
    expect(usable.map((u) => u.content).sort()).toEqual(["عنوان واضح", low[0]!.content].sort());
    expect(await isExtractionBlocked(fileId)).toBe(true);

    // Correct the last low block -> corrected text replaces it, file no longer blocked.
    await reviewExtraction(
      low[1]!.id,
      { status: "corrected", correctedContent: "النص المُصحَّح" },
      "سارة",
    );
    usable = await getUsableExtraction(fileId);
    expect(usable.map((u) => u.content)).toContain("النص المُصحَّح");
    expect(usable).toHaveLength(3);
    expect(await isExtractionBlocked(fileId)).toBe(false);

    const reviewAudit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='extraction.review'",
    );
    expect(reviewAudit.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it("a rejected block stays out of downstream use", async () => {
    const fileId = await uploadPdf();
    await extractFile(fileId, PDF, "منى", {
      ocrEngine: fakeOcr([
        { pageNo: 1, bbox: null, content: "نص مرفوض", sourceClass: "ocr", confidence: 0.9 },
      ]),
    });
    const [block] = await listExtraction(fileId);
    await reviewExtraction(block!.id, { status: "rejected" }, "سارة");
    const usable = await getUsableExtraction(fileId);
    expect(usable.find((u) => u.content === "نص مرفوض")).toBeUndefined();
  });

  it("refuses anonymous extraction and review (rule 00)", async () => {
    const fileId = await uploadDocx();
    await expect(extractFile(fileId, docxBytes(["x"]), "")).rejects.toThrow(
      /actor_name is required/,
    );
    await expect(
      reviewExtraction("00000000-0000-0000-0000-000000000000", { status: "approved" }, ""),
    ).rejects.toThrow(/actor_name is required/);
  });
});
