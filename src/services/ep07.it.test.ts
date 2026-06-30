// @vitest-environment node
//
// EP-07 integration tests (real Postgres, gated on TEST_DATABASE_URL). RAG context is
// built ONLY from gate-cleared extraction (TC-09), ordered by trust (AI-003), and
// structured generation logs requests (AI-002/AI-007). No live OpenRouter calls.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { uploadSource } from "@/services/sourcesService";
import { extractFile, reviewExtraction, listExtraction } from "@/services/extractionService";
import { InMemoryFileStore } from "@/services/fileStore";
import { assembleProgramContext, generateStructured } from "@/services/ragService";
import type { CompletionResult, LLMProvider } from "@/services/llm/types";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n%%EOF", "latin1"));
const ocr = (
  blocks: { content: string; confidence: number }[],
): {
  recognize: () => Promise<
    { pageNo: null; bbox: null; content: string; sourceClass: "ocr"; confidence: number }[]
  >;
} => ({
  recognize: async () =>
    blocks.map((b) => ({ pageNo: null, bbox: null, sourceClass: "ocr" as const, ...b })),
});

class JsonProvider implements LLMProvider {
  readonly modelId = "mock/model";
  constructor(private readonly outputs: string[]) {}
  calls = 0;
  async complete(): Promise<CompletionResult> {
    const content = this.outputs[Math.min(this.calls++, this.outputs.length - 1)]!;
    return { content, model: this.modelId, usage: { tokensIn: 4, tokensOut: 2, costUsd: 0.002 } };
  }
  async testConnection() {
    return { ok: true, message: "ok" };
  }
}

suite("EP-07 — RAG & knowledge engine (integration)", () => {
  let db: IsolatedDb;
  let store: InMemoryFileStore;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep07");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    store = new InMemoryFileStore();
    const sector = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const field = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (
      await createProgram({ name: "برنامج RAG", sectorId: sector, fieldId: field }, "منى")
    ).id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  async function uploadPdf(name: string): Promise<string> {
    const res = await uploadSource(
      {
        programId,
        file: { originalName: name, declaredMime: "application/pdf", bytes: PDF },
        sourceType: "from_center",
      },
      "منى",
      { store },
    );
    return res.fileId;
  }

  it("excludes low-confidence (unreviewed) content from assembled context, includes it once approved", async () => {
    const fileId = await uploadPdf("a.pdf");
    await extractFile(fileId, PDF, "منى", {
      ocrEngine: ocr([
        { content: "حقيقة عالية الثقة", confidence: 0.95 },
        { content: "حقيقة منخفضة الثقة", confidence: 0.3 },
      ]),
    });

    let ctx = await assembleProgramContext(programId);
    expect(ctx.contextText).toContain("حقيقة عالية الثقة");
    expect(ctx.contextText).not.toContain("حقيقة منخفضة الثقة"); // blocked by the gate

    const low = (await listExtraction(fileId)).find((r) => Number(r.confidence) < 0.7)!;
    await reviewExtraction(low.id, { status: "approved" }, "سارة");

    ctx = await assembleProgramContext(programId);
    expect(ctx.contextText).toContain("حقيقة منخفضة الثقة"); // now cleared for use
  });

  it("orders context by source trust (higher-trust file first)", async () => {
    const uniFile = await uploadPdf("uni.pdf");
    const centerFile = await uploadPdf("center.pdf");
    await extractFile(uniFile, PDF, "منى", {
      ocrEngine: ocr([{ content: "محتوى الجامعة", confidence: 0.95 }]),
    });
    await extractFile(centerFile, PDF, "منى", {
      ocrEngine: ocr([{ content: "محتوى المركز", confidence: 0.95 }]),
    });

    const ctx = await assembleProgramContext(programId, {
      sourceTypeByFile: { [uniFile]: "from_university", [centerFile]: "from_center" },
    });
    const idxCenter = ctx.contextText.indexOf("محتوى المركز");
    const idxUni = ctx.contextText.indexOf("محتوى الجامعة");
    expect(idxCenter).toBeGreaterThanOrEqual(0);
    expect(idxCenter).toBeLessThan(idxUni); // from_center (higher trust) appears first
  });

  it("runs schema-constrained generation and logs the request (AI-002/AI-007)", async () => {
    const provider = new JsonProvider(['{"ok":true}']);
    const out = await generateStructured(
      {
        messages: [{ role: "user", content: "أعد JSON" }],
        schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } },
        programId,
      },
      provider,
    );
    expect(out.data).toEqual({ ok: true });
    const rows = await getPool().query(
      "select status, tokens_in from llm_requests where program_id=$1 and status='success'",
      [programId],
    );
    expect(rows.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("logs a schema_failed request when output never validates", async () => {
    const provider = new JsonProvider(["{}", "{}", "{}"]);
    await expect(
      generateStructured(
        {
          messages: [{ role: "user", content: "x" }],
          schema: { type: "object", required: ["must"], properties: { must: { type: "string" } } },
          programId,
          maxRetries: 1,
        },
        provider,
      ),
    ).rejects.toThrow();
    const rows = await getPool().query(
      "select count(*)::int n from llm_requests where status='schema_failed'",
    );
    expect(rows.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
