// =====================================================================
// COMPLIANCE CONFIG — the seed set for the DATA-DRIVEN rules engine (EP-16).
//
// Rules live as ROWS in `compliance_rules` and are editable in the DB with no
// rebuild (D-08). This file only SEEDS the initial set; editing/adding rules at
// runtime does not touch code.
//
// ⛔ V-05 — the OFFICIAL list of "mandatory fields that block export" comes from
//    the NELC guide and is NOT yet confirmed. Rules whose thresholds/field list
//    depend on it are marked `isPlaceholder: true`. When the guide arrives, adjust
//    ONLY this file (add/tune the mandatory-field rules, flip `isPlaceholder`);
//    the engine, persistence, and export gate are unchanged.
//
//    Rules taken verbatim from `.claude/rules/10-business-rules.md` (BR-001/002)
//    are NOT placeholders — those thresholds are already fixed by the owner.
// =====================================================================

import type { RuleType } from "@/domain/complianceEngine";
import type { Severity } from "@/domain/businessRules";

export interface ComplianceRuleSeed {
  ruleCode: string; // stable code (also snapshotted onto each check)
  category: "structure" | "field" | "quality";
  severity: Severity; // blocking | warning | suggestion
  ruleType: RuleType;
  factKey: string; // which ProgramFact the rule reads
  params: { min?: number; max?: number };
  message: string; // Arabic, user-facing (rule 50) — {value} interpolated
  description: string;
  isActive: boolean;
  isPlaceholder: boolean; // V-05 not finalized
}

export interface ComplianceConfig {
  // true while ANY placeholder (V-05) rule is present — surfaced in the UI/gate so
  // no one mistakes the mandatory-field list for the final official one.
  isPlaceholder: boolean;
  rules: ComplianceRuleSeed[];
}

export const PLACEHOLDER_COMPLIANCE_CONFIG: ComplianceConfig = {
  isPlaceholder: true,
  rules: [
    // ---- Structure — REAL thresholds from rule 10 (not placeholders) ----
    {
      ruleCode: "COMP-BR-001",
      category: "structure",
      severity: "blocking",
      ruleType: "numeric_min_max",
      factKey: "courses_count",
      params: { min: 2, max: 6 },
      message: "يجب أن يحتوي البرنامج على 2 إلى 6 مقررات (القاعدة BR-001). العدد الحالي: {value}.",
      description: "عدد المقررات ضمن النطاق 2–6 (BR-001).",
      isActive: true,
      isPlaceholder: false,
    },
    {
      ruleCode: "COMP-BR-002",
      category: "structure",
      severity: "blocking",
      ruleType: "numeric_min_max",
      factKey: "total_credit_hours",
      params: { min: 3, max: 23 },
      message:
        "يجب أن يكون إجمالي الساعات المعتمدة بين 3 و 23 (القاعدة BR-002). الإجمالي الحالي: {value}.",
      description: "إجمالي الساعات المعتمدة ضمن النطاق 3–23 (BR-002).",
      isActive: true,
      isPlaceholder: false,
    },

    // ---- Mandatory fields that block export — V-05 PLACEHOLDER ----
    // Program name is an obviously-required field, but the OFFICIAL mandatory-field
    // list is still V-05; flagged so it is not mistaken for the final list.
    {
      ruleCode: "COMP-FIELD-PROGRAM-NAME",
      category: "field",
      severity: "blocking",
      ruleType: "required_present",
      factKey: "program_name_present",
      params: {},
      message: "اسم البرنامج حقل إلزامي ويجب ألا يكون فارغًا (بانتظار قائمة الحقول الرسمية V-05).",
      description: "حقل إلزامي: اسم البرنامج (V-05 مؤقت).",
      isActive: true,
      isPlaceholder: true,
    },

    // ---- Quality nudge — low quality does NOT block (BR-019), placeholder ----
    {
      ruleCode: "COMP-QUALITY-REFERENCES",
      category: "quality",
      severity: "warning",
      ruleType: "numeric_min",
      factKey: "verified_references_count",
      params: { min: 1 },
      message:
        "يُفضّل وجود مرجع مُوثَّق واحد على الأقل قبل التصدير (لا يمنع التصدير، يتطلب تبريرًا — BR-019).",
      description: "جودة: وجود مراجع موثّقة (تحذير، V-05 مؤقت).",
      isActive: true,
      isPlaceholder: true,
    },
  ],
};

export function activeComplianceConfig(): ComplianceConfig {
  return PLACEHOLDER_COMPLIANCE_CONFIG;
}
