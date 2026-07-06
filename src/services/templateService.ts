// Templates & Word generation service (EP-15). Registers template versions (seeding
// fields + mappings from the swappable config), diff/approval, and fills the ORIGINAL
// .docx (never HTML->Word) with a fidelity + completeness check.
//
// V-01 (required field list) and V-06 (mechanism) live ONLY in @/config/templateConfig,
// so the real template drops in there with zero change here.

import { randomUUID } from "node:crypto";
import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getPool } from "@/data/pool";
import {
  insertTemplate,
  insertTemplateVersion,
  nextVersionNo,
  insertFieldsAndMappings,
  listTemplateFields,
  listTemplateMappings,
  approveTemplateVersion,
  isVersionApproved,
  getVersionStoragePath,
  insertGeneratedDocument,
  getGeneratedDocument,
} from "@/data/templateRepo";
import { type FileStore, SupabaseFileStore } from "@/services/fileStore";
import { buildPlaceholderDocx } from "@/services/word/placeholderTemplate";
import { fillDocxTemplate, readDocxText, assertDocx } from "@/services/word/fillEngine";
import {
  checkFieldCompleteness,
  findUnresolvedPlaceholders,
  diffTemplateFields,
  type FieldDiff,
} from "@/domain/templateFidelity";
import {
  activeTemplateConfig,
  type TemplateConfig,
  type TemplateFieldConfig,
} from "@/config/templateConfig";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Register a template + its first version, seeding fields/mappings and storing the
// (placeholder) .docx. Returns the ids.
export async function registerTemplate(
  input: { name: string; config?: TemplateConfig },
  actor: string,
  deps: { store?: FileStore } = {},
): Promise<{ templateId: string; versionId: string }> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const config = input.config ?? activeTemplateConfig();
  const store = deps.store ?? new SupabaseFileStore();

  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let templateId = "";
    let versionId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "template.register",
        new_value: { name: input.name, docType: config.docType },
      },
      async () => {
        templateId = await insertTemplate(client, { name: input.name, docType: config.docType });
        const versionNo = 1;
        const storagePath = `templates/${templateId}/v${versionNo}.docx`;
        await store.put(storagePath, buildPlaceholderDocx(config.fields), DOCX_MIME);
        versionId = await insertTemplateVersion(client, {
          templateId,
          versionNo,
          storagePath,
          actor,
        });
        await insertFieldsAndMappings(client, versionId, config.fields);
      },
      sink,
    );
    return { templateId, versionId };
  });
}

// Add a new version of an existing template (keeps history; migrate mappings, R-11).
export async function addTemplateVersion(
  templateId: string,
  config: TemplateConfig,
  actor: string,
  deps: { store?: FileStore } = {},
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const store = deps.store ?? new SupabaseFileStore();
  const versionNo = await nextVersionNo(templateId);
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let versionId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "template.version.add",
        new_value: { templateId, versionNo },
      },
      async () => {
        const storagePath = `templates/${templateId}/v${versionNo}.docx`;
        await store.put(storagePath, buildPlaceholderDocx(config.fields), DOCX_MIME);
        versionId = await insertTemplateVersion(client, {
          templateId,
          versionNo,
          storagePath,
          actor,
        });
        await insertFieldsAndMappings(client, versionId, config.fields);
      },
      sink,
    );
    return versionId;
  });
}

export async function approveTemplate(versionId: string, actor: string): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "template.version.approve", new_value: { versionId } },
      async () => {
        const ok = await approveTemplateVersion(client, versionId);
        if (!ok) throw new Error("approveTemplate: version not found");
      },
      sink,
    );
  });
}

// Diff two versions' field sets (added/removed/changed) using the DB rows + mappings.
export async function diffVersions(versionA: string, versionB: string): Promise<FieldDiff> {
  const [aFields, aMaps, bFields, bMaps] = await Promise.all([
    listTemplateFields(versionA),
    listTemplateMappings(versionA),
    listTemplateFields(versionB),
    listTemplateMappings(versionB),
  ]);
  const toConfig = (
    fields: { field_key: string; control_type: string | null; is_required: boolean }[],
    maps: { field_key: string; db_source: string }[],
  ): TemplateFieldConfig[] =>
    fields.map((f) => ({
      key: f.field_key,
      label: f.field_key,
      required: f.is_required,
      controlType: (f.control_type as TemplateFieldConfig["controlType"]) ?? "content_control",
      dbSource: maps.find((m) => m.field_key === f.field_key)?.db_source ?? "",
    }));
  return diffTemplateFields(toConfig(aFields, aMaps), toConfig(bFields, bMaps));
}

// Template Mapping Engine: resolve each field's value from its db_source (rule 60).
async function resolveFieldValues(
  programId: string,
  fields: TemplateFieldConfig[],
): Promise<Record<string, string>> {
  const program = (
    await getPool().query(
      `select p.name, s.name as sector, f.name as field from programs p
         join sectors s on s.id = p.sector_id join fields f on f.id = p.field_id where p.id = $1`,
      [programId],
    )
  ).rows[0];
  const schedule = (
    await getPool().query(
      "select total_credit::float as tc, total_actual::float as ta from program_schedules where program_id = $1 order by created_at desc limit 1",
      [programId],
    )
  ).rows[0];
  const courses = (
    await getPool().query(
      "select count(*)::int as c from courses where program_id = $1 and is_deleted = false",
      [programId],
    )
  ).rows[0];

  const bySource: Record<string, string> = {
    "programs.name": program?.name ?? "",
    "sectors.name": program?.sector ?? "",
    "fields.name": program?.field ?? "",
    "program_schedules.total_credit": schedule?.tc != null ? String(schedule.tc) : "",
    "program_schedules.total_actual": schedule?.ta != null ? String(schedule.ta) : "",
    "computed.courses_count": courses?.c != null ? String(courses.c) : "",
  };
  const values: Record<string, string> = {};
  for (const f of fields) values[f.key] = bySource[f.dbSource] ?? "";
  return values;
}

export interface GenerateResult {
  docId: string;
  fidelityPassed: boolean;
  missingRequired: string[];
  isPlaceholder: boolean;
}

// Fill the ORIGINAL template for a program; run fidelity + completeness; store the doc.
export async function generateProgramDocument(
  programId: string,
  versionId: string,
  actor: string,
  deps: { store?: FileStore; config?: TemplateConfig } = {},
): Promise<GenerateResult> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const config = deps.config ?? activeTemplateConfig();
  const store = deps.store ?? new SupabaseFileStore();

  const storagePath = await getVersionStoragePath(versionId);
  if (!storagePath) throw new Error("generateProgramDocument: template version not found");

  const templateBytes = await store.download(storagePath);
  const values = await resolveFieldValues(programId, config.fields);
  const completeness = checkFieldCompleteness(config.fields, values);

  const filled = fillDocxTemplate(templateBytes, values);
  const text = readDocxText(filled);

  let fidelityPassed = findUnresolvedPlaceholders(text).length === 0;
  try {
    assertDocx(filled); // still a real .docx, not HTML
  } catch {
    fidelityPassed = false;
  }

  const outPath = `generated/${programId}/${randomUUID()}.docx`;
  await store.put(outPath, filled, DOCX_MIME);

  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let docId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "document.generate",
        program_id: programId,
        new_value: { versionId, fidelityPassed, missingRequired: completeness.missingRequired },
      },
      async () => {
        docId = await insertGeneratedDocument(client, {
          programId,
          templateVersionId: versionId,
          docType: config.docType,
          storagePath: outPath,
          fidelityPassed,
          actor,
        });
      },
      sink,
    );
    return {
      docId,
      fidelityPassed,
      missingRequired: completeness.missingRequired,
      isPlaceholder: config.isPlaceholder,
    };
  });
}

export { listTemplateFields, listTemplateMappings, isVersionApproved, getGeneratedDocument };
