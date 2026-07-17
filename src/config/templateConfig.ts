// =====================================================================
// TEMPLATE CONFIG — the SINGLE swap point for the official Word template.
//
// ⛔ PLACEHOLDER (V-01 field list + V-06 mechanism are UNKNOWN until the real
//    official template is provided). When it arrives, replace ONLY this file's
//    contents — the field keys, `required` flags, `controlType`, and `dbSource`
//    mapping — and set `isPlaceholder: false`. No other code changes are needed:
//    the mapping engine, fill engine, fidelity harness, and versioning all read
//    from here (or from template_fields seeded from here).
//
//    Until then, the "missing required field -> blocking export" rule (BR-013 /
//    TC-08) stays FLAGGED, gated on `isPlaceholder`.
// =====================================================================

export type ControlType = "content_control" | "bookmark" | "table";

export interface TemplateFieldConfig {
  key: string; // matches the placeholder tag in the .docx, e.g. {program_name}
  label: string; // Arabic label (for the mapping UI)
  required: boolean; // V-01: which fields block export — placeholder guesses NOTHING final
  controlType: ControlType; // V-06 mechanism
  dbSource: string; // table.column or section reference
}

export interface TemplateConfig {
  docType: "program_card" | "program_document" | "course_descriptor" | "other";
  mechanism: ControlType; // V-06
  isPlaceholder: boolean; // true => TC-08 stays flagged, required-field gate not final
  fields: TemplateFieldConfig[];
}

// Generic, clearly-placeholder fields — NOT the official NELC field list.
export const PLACEHOLDER_TEMPLATE_CONFIG: TemplateConfig = {
  docType: "program_document",
  mechanism: "content_control",
  isPlaceholder: true,
  fields: [
    {
      key: "program_name",
      label: "اسم البرنامج",
      required: true,
      controlType: "content_control",
      dbSource: "programs.name",
    },
    {
      key: "sector",
      label: "القطاع",
      required: false,
      controlType: "content_control",
      dbSource: "sectors.name",
    },
    {
      key: "field",
      label: "المجال",
      required: false,
      controlType: "content_control",
      dbSource: "fields.name",
    },
    {
      key: "total_credit_hours",
      label: "إجمالي الساعات المعتمدة",
      required: true,
      controlType: "content_control",
      dbSource: "program_schedules.total_credit",
    },
    {
      key: "total_actual_hours",
      label: "إجمالي الساعات الفعلية",
      required: false,
      controlType: "content_control",
      dbSource: "program_schedules.total_actual",
    },
    {
      key: "courses_count",
      label: "عدد المقررات",
      required: false,
      controlType: "content_control",
      dbSource: "computed.courses_count",
    },
  ],
};

export function activeTemplateConfig(): TemplateConfig {
  return PLACEHOLDER_TEMPLATE_CONFIG;
}
