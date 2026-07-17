// @vitest-environment node
//
// EP-15 integration tests (real Postgres + in-memory store, gated on TEST_DATABASE_URL).
// Proves what is NOT blocked by V-01/V-06: template versioning/diff/approval, the
// docxtemplater fill of the ORIGINAL template, and the fidelity harness.
// TC-08 (missing-required -> blocking export) stays FLAGGED until the real template.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import { setSchedule } from "@/services/schedulingService";
import { InMemoryFileStore } from "@/services/fileStore";
import {
  registerTemplate,
  addTemplateVersion,
  approveTemplate,
  diffVersions,
  generateProgramDocument,
  listTemplateFields,
  listTemplateMappings,
  isVersionApproved,
  getGeneratedDocument,
} from "@/services/templateService";
import { readDocxText } from "@/services/word/fillEngine";
import { PLACEHOLDER_TEMPLATE_CONFIG } from "@/config/templateConfig";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-15 — templates & Word generation (integration)", () => {
  let db: IsolatedDb;
  let store: InMemoryFileStore;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep15");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    store = new InMemoryFileStore();
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (await createProgram({ name: "برنامج القوالب", sectorId, fieldId }, "منى")).id;
    await addCourse(programId, { title: "مقرر", creditHours: 3 }, "منى"); // 45 actual hours
    await setSchedule(programId, 3, "منى"); // weekly load 15 -> totals available
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("registers a template + version, seeding fields and mappings from the config", async () => {
    const { versionId } = await registerTemplate({ name: "قالب البرنامج" }, "منى", { store });
    const fields = await listTemplateFields(versionId);
    const maps = await listTemplateMappings(versionId);
    expect(fields.length).toBe(PLACEHOLDER_TEMPLATE_CONFIG.fields.length);
    expect(maps.length).toBe(PLACEHOLDER_TEMPLATE_CONFIG.fields.length);
    expect(fields.find((f) => f.field_key === "program_name")!.is_required).toBe(true);
  });

  it("diffs template versions and supports approval", async () => {
    const { templateId, versionId } = await registerTemplate({ name: "قالب" }, "منى", { store });

    // Same config -> no diff.
    const v2 = await addTemplateVersion(templateId, PLACEHOLDER_TEMPLATE_CONFIG, "منى", { store });
    const sameDiff = await diffVersions(versionId, v2);
    expect(sameDiff.added).toEqual([]);
    expect(sameDiff.removed).toEqual([]);

    // A version with an added field -> diff shows it.
    const modified = {
      ...PLACEHOLDER_TEMPLATE_CONFIG,
      fields: [
        ...PLACEHOLDER_TEMPLATE_CONFIG.fields,
        {
          key: "accreditation_no",
          label: "رقم الاعتماد",
          required: false,
          controlType: "content_control" as const,
          dbSource: "computed.accreditation",
        },
      ],
    };
    const v3 = await addTemplateVersion(templateId, modified, "منى", { store });
    expect((await diffVersions(versionId, v3)).added).toContain("accreditation_no");

    // Approval.
    expect(await isVersionApproved(versionId)).toBe(false);
    await approveTemplate(versionId, "منى");
    expect(await isVersionApproved(versionId)).toBe(true);
  });

  it("fills the ORIGINAL template for a program and passes the fidelity check", async () => {
    const { versionId } = await registerTemplate({ name: "قالب التوليد" }, "منى", { store });
    const result = await generateProgramDocument(programId, versionId, "منى", { store });

    expect(result.fidelityPassed).toBe(true); // no unresolved placeholders, still a .docx
    expect(result.isPlaceholder).toBe(true); // TC-08 stays flagged until the real template

    // The generated document is recorded with fidelity_passed = true.
    const doc = (await getGeneratedDocument(result.docId)) as {
      fidelity_passed: boolean;
      storage_path: string;
    };
    expect(doc.fidelity_passed).toBe(true);

    // The stored .docx actually contains the program's data (real fill, not HTML).
    const bytes = await store.download(doc.storage_path);
    const text = readDocxText(bytes);
    expect(text).toContain("برنامج القوالب");
    expect(text).not.toMatch(/\{[^}]+\}/); // nothing left unresolved

    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='document.generate'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("refuses anonymous template operations (rule 00)", async () => {
    await expect(registerTemplate({ name: "x" }, "", { store })).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
