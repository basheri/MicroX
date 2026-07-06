// Templates & generated docs data layer (EP-15): official_templates, template_versions,
// template_fields, template_mappings, generated_documents.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import type { TemplateFieldConfig } from "@/config/templateConfig";

export async function insertTemplate(
  client: PoolClient,
  input: { name: string; docType: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    "insert into official_templates (name, doc_type) values ($1, $2) returning id",
    [input.name, input.docType],
  );
  return rows.rows[0]!.id;
}

export async function insertTemplateVersion(
  client: PoolClient,
  input: { templateId: string; versionNo: number; storagePath: string; actor: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into template_versions (template_id, version_no, storage_path, approved, created_by_actor)
     values ($1, $2, $3, false, $4) returning id`,
    [input.templateId, input.versionNo, input.storagePath, input.actor],
  );
  return rows.rows[0]!.id;
}

export async function nextVersionNo(templateId: string): Promise<number> {
  const rows = await getPool().query<{ n: number }>(
    "select coalesce(max(version_no), 0) + 1 as n from template_versions where template_id = $1",
    [templateId],
  );
  return rows.rows[0]!.n;
}

// Seed template_fields + template_mappings for a version from the config.
export async function insertFieldsAndMappings(
  client: PoolClient,
  templateVersionId: string,
  fields: TemplateFieldConfig[],
): Promise<void> {
  for (const f of fields) {
    await client.query(
      "insert into template_fields (template_version_id, field_key, control_type, is_required) values ($1, $2, $3, $4)",
      [templateVersionId, f.key, f.controlType, f.required],
    );
    await client.query(
      "insert into template_mappings (template_version_id, field_key, db_source) values ($1, $2, $3)",
      [templateVersionId, f.key, f.dbSource],
    );
  }
}

export interface TemplateFieldRow {
  field_key: string;
  control_type: string | null;
  is_required: boolean;
}

export async function listTemplateFields(versionId: string): Promise<TemplateFieldRow[]> {
  return (
    await getPool().query<TemplateFieldRow>(
      "select field_key, control_type, is_required from template_fields where template_version_id = $1 order by field_key",
      [versionId],
    )
  ).rows;
}

export async function listTemplateMappings(versionId: string) {
  return (
    await getPool().query(
      "select field_key, db_source from template_mappings where template_version_id = $1 order by field_key",
      [versionId],
    )
  ).rows;
}

export async function approveTemplateVersion(
  client: PoolClient,
  versionId: string,
): Promise<boolean> {
  const res = await client.query("update template_versions set approved = true where id = $1", [
    versionId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function isVersionApproved(versionId: string): Promise<boolean> {
  const rows = await getPool().query<{ approved: boolean }>(
    "select approved from template_versions where id = $1",
    [versionId],
  );
  return rows.rows[0]?.approved ?? false;
}

export async function getVersionStoragePath(versionId: string): Promise<string | null> {
  const rows = await getPool().query<{ storage_path: string }>(
    "select storage_path from template_versions where id = $1",
    [versionId],
  );
  return rows.rows[0]?.storage_path ?? null;
}

export async function insertGeneratedDocument(
  client: PoolClient,
  input: {
    programId: string;
    templateVersionId: string;
    docType: string;
    storagePath: string;
    fidelityPassed: boolean;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into generated_documents (program_id, template_version_id, doc_type, storage_path, fidelity_passed, created_by_actor)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      input.programId,
      input.templateVersionId,
      input.docType,
      input.storagePath,
      input.fidelityPassed,
      input.actor,
    ],
  );
  return rows.rows[0]!.id;
}

export async function getGeneratedDocument(docId: string) {
  const rows = await getPool().query(
    "select id, program_id, template_version_id, doc_type, storage_path, fidelity_passed from generated_documents where id = $1",
    [docId],
  );
  return rows.rows[0] ?? null;
}
