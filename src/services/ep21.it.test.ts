// @vitest-environment node
//
// EP-21 integration tests (real Postgres + in-memory store, gated on TEST_DATABASE_URL).
// Proves the submission-package assembler: it builds ONLY past the compliance gate
// (BR-019), fills the ORIGINAL Word template (EP-15), and produces an index listing
// every artifact + requirement status — with NO correspondence artifacts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import { InMemoryFileStore } from "@/services/fileStore";
import { registerTemplate } from "@/services/templateService";
import { seedComplianceRules, ExportBlockedError } from "@/services/complianceService";
import { buildExportPackage, getExportPackage } from "@/services/exportPackageService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-21 — export package (integration)", () => {
  let db: IsolatedDb;
  let store: InMemoryFileStore;
  let validProgram: string;
  let invalidProgram: string;
  let templateVersionId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep21");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    store = new InMemoryFileStore();
    await seedComplianceRules("منى");

    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;

    validProgram = (await createProgram({ name: "برنامج للتصدير", sectorId, fieldId }, "منى")).id;
    await addCourse(validProgram, { title: "مقرر ١", creditHours: 3 }, "منى");
    await addCourse(validProgram, { title: "مقرر ٢", creditHours: 3 }, "منى");
    // A verified reference so the compliance gate is CLEAR (no justification needed).
    await getPool().query(
      "insert into program_references (program_id, citation, language, verified) values ($1,'مرجع','ar',true)",
      [validProgram],
    );

    invalidProgram = (await createProgram({ name: "برنامج ناقص", sectorId, fieldId }, "منى")).id;
    await addCourse(invalidProgram, { title: "مقرر وحيد", creditHours: 3 }, "منى"); // 1 course -> BR-001 blocking

    templateVersionId = (await registerTemplate({ name: "قالب" }, "منى", { store })).versionId;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("REFUSES to build a package when a blocking compliance error exists (gate first)", async () => {
    await expect(
      buildExportPackage(invalidProgram, templateVersionId, "منى", { store }),
    ).rejects.toBeInstanceOf(ExportBlockedError);

    // No package row and no stored zip were created for the blocked program.
    const pkgs = await getPool().query(
      "select count(*)::int n from export_packages where program_id=$1",
      [invalidProgram],
    );
    expect(pkgs.rows[0].n).toBe(0);
  });

  it("builds a complete package past the gate, with a filled .docx and a full index", async () => {
    const result = await buildExportPackage(validProgram, templateVersionId, "منى", { store });
    expect(result.decision).toBe("clear");
    expect(result.manifest.length).toBeGreaterThanOrEqual(6);

    // The package is a real zip containing the Word document + reports + index.
    const pkg = await getExportPackage(result.packageId);
    const zip = await store.download(pkg!.storage_path!);
    expect(zip[0]).toBe(0x50); // PK
    const files = unzipSync(zip);
    const names = Object.keys(files);
    expect(names).toContain("program-document.docx");
    expect(names).toContain("reports/compliance.json");
    expect(names).toContain("reports/quality.json");
    expect(names).toContain("index.md");

    // The Word artifact is a real .docx (PK), never HTML→Word.
    expect(files["program-document.docx"]![0]).toBe(0x50);

    // The index lists every artifact + requirement status.
    const indexMd = strFromU8(files["index.md"]!);
    expect(indexMd).toContain("فهرس حزمة التصدير");
    expect(indexMd).toContain("الوثيقة الرسمية");
  });

  it("the manifest contains NO correspondence (no emails/letters) — rule 00", async () => {
    const result = await buildExportPackage(validProgram, templateVersionId, "منى", { store });
    const types = result.manifest.map((m) => m.type);
    expect(types).not.toContain("email");
    expect(types).not.toContain("letter");
    expect(types).not.toContain("correspondence");
    // Every entry is an approved artifact type.
    const allowed = new Set([
      "word_document",
      "compliance_report",
      "quality_report",
      "version_log",
      "references_list",
      "delivery_checklist",
      "index",
    ]);
    expect(types.every((t) => allowed.has(t))).toBe(true);
  });

  it("records the package with its index manifest and is audited", async () => {
    const result = await buildExportPackage(validProgram, templateVersionId, "منى", { store });
    const pkg = await getExportPackage(result.packageId);
    expect(pkg?.status).toBe("ready");
    expect(Array.isArray(pkg?.index_manifest)).toBe(true);

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where program_id=$1 and operation_type='program.export.package'",
      [validProgram],
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("refuses anonymous package builds (rule 00)", async () => {
    await expect(
      buildExportPackage(validProgram, templateVersionId, "", { store }),
    ).rejects.toThrow(/actor_name is required/);
  });
});
