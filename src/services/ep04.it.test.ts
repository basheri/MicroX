// @vitest-environment node
//
// EP-04 integration tests (real Postgres + in-memory file store, gated on TEST_DATABASE_URL).
// Proves the DoD: disallowed types rejected; file stored + signed-URL retrievable;
// redaction removes PII and logs it (SEC-006); malware rejected (SEC-004).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { uploadSource, redactAndLog, InfectedFileError } from "@/services/sourcesService";
import { UploadValidationError } from "@/domain/uploadValidation";
import { listProgramFiles } from "@/data/sourcesRepo";
import { InMemoryFileStore } from "@/services/fileStore";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const PDF = bytes("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF");
const EICAR_PDF = bytes(
  "%PDF-1.7\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF",
);

suite("EP-04 — sources & files (integration)", () => {
  let db: IsolatedDb;
  let store: InMemoryFileStore;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep04");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    store = new InMemoryFileStore();
    const sector = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const field = (await getPool().query("select id from fields limit 1")).rows[0].id;
    const p = await createProgram(
      { name: "برنامج المصادر", sectorId: sector, fieldId: field },
      "منى",
    );
    programId = p.id;
  });

  afterAll(async () => {
    await db?.teardown();
  });

  it("stores an allowed PDF privately, lists it, audits it, and serves it via signed URL", async () => {
    const res = await uploadSource(
      {
        programId,
        file: { originalName: "دليل.pdf", declaredMime: "application/pdf", bytes: PDF },
        sourceType: "from_center",
        notes: "ملف رسمي",
      },
      "منى",
      { store },
    );
    expect(res.fileId).toBeTruthy();

    const files = await listProgramFiles(programId);
    expect(files).toHaveLength(1);
    expect(files[0]!.scan_status).toBe("clean");
    expect(files[0]!.mime_type).toBe("application/pdf");

    const audit = await getPool().query(
      "select * from audit_logs where program_id=$1 and operation_type='source.upload'",
      [programId],
    );
    expect(audit.rows[0].actor_name).toBe("منى");

    // Signed URL resolves and the stored bytes match (SEC-007 retrieval).
    const signed = await store.signedUrl(res.storagePath);
    expect(signed).toContain(res.storagePath);
    expect(store.get(res.storagePath)).toEqual(PDF);
  });

  it("rejects a disallowed type and stores nothing new", async () => {
    const before = (await listProgramFiles(programId)).length;
    await expect(
      uploadSource(
        {
          programId,
          file: { originalName: "ملاحظات.txt", declaredMime: "text/plain", bytes: bytes("hello") },
          sourceType: "from_center",
        },
        "منى",
        { store },
      ),
    ).rejects.toBeInstanceOf(UploadValidationError);
    expect((await listProgramFiles(programId)).length).toBe(before);
  });

  it("rejects an infected file (EICAR) before storing it", async () => {
    const before = (await listProgramFiles(programId)).length;
    await expect(
      uploadSource(
        {
          programId,
          file: { originalName: "بريء.pdf", declaredMime: "application/pdf", bytes: EICAR_PDF },
          sourceType: "from_center",
        },
        "منى",
        { store },
      ),
    ).rejects.toBeInstanceOf(InfectedFileError);
    expect((await listProgramFiles(programId)).length).toBe(before);
  });

  it("redacts PII from model-bound text and logs every redaction (SEC-006)", async () => {
    const upload = await uploadSource(
      {
        programId,
        file: { originalName: "مصدر.pdf", declaredMime: "application/pdf", bytes: PDF },
        sourceType: "from_university",
      },
      "منى",
      { store },
    );

    const raw = "د. سعد القحطاني، saad@example.com، 0501112222، الهوية 1098765432.";
    const out = await redactAndLog({
      uploadedFileId: upload.fileId,
      text: raw,
      knownNames: [],
      actor: "منى",
    });

    expect(out.redactedText).not.toContain("saad@example.com");
    expect(out.redactedText).not.toContain("0501112222");
    expect(out.redactedText).not.toContain("1098765432");
    expect(out.redactedText).not.toContain("القحطاني");

    const logs = await getPool().query<{ entity_type: string; count: number }>(
      "select entity_type, count from redaction_logs where uploaded_file_id=$1 order by entity_type",
      [upload.fileId],
    );
    const byType = Object.fromEntries(logs.rows.map((r) => [r.entity_type, Number(r.count)]));
    expect(byType.email).toBe(1);
    expect(byType.phone).toBe(1);
    expect(byType.national_id).toBe(1);
    expect(byType.name).toBeGreaterThanOrEqual(1);

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='redaction.run'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("refuses anonymous upload and redaction (rule 00)", async () => {
    await expect(
      uploadSource(
        {
          programId,
          file: { originalName: "x.pdf", declaredMime: "application/pdf", bytes: PDF },
          sourceType: "from_center",
        },
        "",
        { store },
      ),
    ).rejects.toThrow(/actor_name is required/);
    await expect(redactAndLog({ text: "a@b.com", actor: "" })).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
