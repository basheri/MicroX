// Export package assembler (EP-21). Builds the full NELC submission package ONLY past
// the compliance gate (BR-019): the filled ORIGINAL Word document (EP-15, never
// HTML→Word) plus machine-readable reports and a human-readable index that lists every
// artifact and its requirement status. No emails, cover letters, or correspondence are
// ever generated (rule 00 — out of scope).

import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import { type FileStore, SupabaseFileStore } from "@/services/fileStore";
import { enforceExportGate, getComplianceChecks } from "@/services/complianceService";
import { generateProgramDocument, getGeneratedDocument } from "@/services/templateService";
import { getProgramQuality } from "@/services/qualityService";
import { getProgramVersions } from "@/services/versioningService";
import { getVerifiedReferences } from "@/services/referenceService";
import { insertPackage, getPackage, type PackageRow } from "@/data/exportRepo";

const ZIP_MIME = "application/zip";

// Allowed artifact types — a guard so the package can NEVER contain correspondence.
const ALLOWED_ARTIFACT_TYPES = new Set([
  "word_document",
  "compliance_report",
  "quality_report",
  "version_log",
  "references_list",
  "delivery_checklist",
  "index",
]);

export interface ManifestEntry {
  name: string; // file name inside the package
  type: string; // artifact type (must be in ALLOWED_ARTIFACT_TYPES)
  requirement: string; // which requirement/section it satisfies
  status: string; // pass | needs_justification | present | ...
}

export interface BuildPackageResult {
  packageId: string;
  storagePath: string;
  manifest: ManifestEntry[];
  fidelityPassed: boolean;
  decision: string;
}

export async function buildExportPackage(
  programId: string,
  templateVersionId: string,
  actor: string,
  opts: { justification?: string; store?: FileStore } = {},
): Promise<BuildPackageResult> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("buildExportPackage: program not found");
  const store = opts.store ?? new SupabaseFileStore();

  // 1) COMPLIANCE GATE FIRST (BR-019). Throws ExportBlockedError / JustificationRequiredError.
  //    Nothing is assembled or stored if the gate does not pass.
  const gate = await enforceExportGate(programId, actor, opts.justification);

  // 2) Fill the ORIGINAL Word template (EP-15).
  const doc = await generateProgramDocument(programId, templateVersionId, actor, { store });
  const docMeta = (await getGeneratedDocument(doc.docId)) as { storage_path: string };
  const wordBytes = await store.download(docMeta.storage_path);

  // 3) Gather the report inputs (all real, from the DB).
  const [checks, quality, versions, references] = await Promise.all([
    getComplianceChecks(programId),
    getProgramQuality(programId),
    getProgramVersions(programId),
    getVerifiedReferences(programId),
  ]);

  const complianceReport = {
    decision: gate.decision,
    justification: gate.justification,
    checks,
  };
  const overall = quality.find((q) => q.axis === "overall")?.score ?? null;
  const qualityReport = { overall, axes: quality };

  // 4) Assemble the package files.
  const files: Record<string, Uint8Array> = {
    "program-document.docx": wordBytes,
    "reports/compliance.json": strToU8(JSON.stringify(complianceReport, null, 2)),
    "reports/quality.json": strToU8(JSON.stringify(qualityReport, null, 2)),
    "reports/version-log.json": strToU8(JSON.stringify(versions, null, 2)),
    "reports/references.json": strToU8(JSON.stringify(references, null, 2)),
  };

  const manifest: ManifestEntry[] = [
    {
      name: "program-document.docx",
      type: "word_document",
      requirement: "الوثيقة الرسمية (القالب المعبّأ)",
      status: doc.fidelityPassed ? "pass" : "fidelity_failed",
    },
    {
      name: "reports/compliance.json",
      type: "compliance_report",
      requirement: "تقرير التوافق (BR-019)",
      status: gate.decision,
    },
    {
      name: "reports/quality.json",
      type: "quality_report",
      requirement: "تقرير الجودة (ستة محاور)",
      status: overall == null ? "not_assessed" : "present",
    },
    {
      name: "reports/version-log.json",
      type: "version_log",
      requirement: "سجل النسخ",
      status: `${versions.length} نسخة`,
    },
    {
      name: "reports/references.json",
      type: "references_list",
      requirement: "المراجع الموثّقة",
      status: `${references.length} مرجع`,
    },
    {
      name: "delivery-checklist.json",
      type: "delivery_checklist",
      requirement: "قائمة التسليم",
      status: doc.isPlaceholder ? "template_placeholder" : "ready",
    },
  ];

  // Delivery checklist derived from the manifest (what is present + its status).
  const checklist = {
    program: program.name,
    generatedForVersion: versions[0]?.version_no ?? null,
    items: manifest.map((m) => ({ requirement: m.requirement, status: m.status })),
    note: doc.isPlaceholder ? "القالب الرسمي (V-01/V-06) غير مركّب بعد — نسخة بديلة معلّمة." : null,
  };
  files["delivery-checklist.json"] = strToU8(JSON.stringify(checklist, null, 2));

  // Human-readable index listing every artifact + its requirement status.
  const indexMd = [
    `# فهرس حزمة التصدير — ${program.name}`,
    "",
    "| الملف | المتطلب | الحالة |",
    "| --- | --- | --- |",
    ...manifest.map((m) => `| ${m.name} | ${m.requirement} | ${m.status} |`),
  ].join("\n");
  files["index.md"] = strToU8(indexMd);
  manifest.push({
    name: "index.md",
    type: "index",
    requirement: "فهرس الحزمة",
    status: "present",
  });

  // Guard: NEVER any correspondence artifact in the package (rule 00).
  for (const m of manifest) {
    if (!ALLOWED_ARTIFACT_TYPES.has(m.type)) {
      throw new Error(`buildExportPackage: disallowed artifact type "${m.type}"`);
    }
  }

  // 5) Zip + store (private path; served later via signed URL only).
  const zip = zipSync(files);
  const storagePath = `packages/${programId}/${randomUUID()}.zip`;
  await store.put(storagePath, zip, ZIP_MIME);

  // 6) Record the package with its manifest (auditable).
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let packageId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.export.package",
        program_id: programId,
        override_justification: gate.justification,
        new_value: { decision: gate.decision, artifacts: manifest.length },
      },
      async () => {
        packageId = await insertPackage(client, {
          programId,
          status: "ready",
          storagePath,
          indexManifest: manifest,
          justification: gate.justification,
          actor,
        });
      },
      sink,
    );
    return {
      packageId,
      storagePath,
      manifest,
      fidelityPassed: doc.fidelityPassed,
      decision: gate.decision,
    };
  });
}

export function getExportPackage(id: string): Promise<PackageRow | null> {
  return getPackage(id);
}
