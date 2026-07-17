// Template fidelity + field-completeness + version diff (EP-15). PURE.
// The FILL engine (never HTML->Word) must preserve the original template; these checks
// verify completeness and that no placeholder was left unresolved.

import type { TemplateFieldConfig } from "@/config/templateConfig";

export interface CompletenessResult {
  complete: boolean;
  missingRequired: string[]; // field keys required but empty/absent
}

// Field-completeness (BR-013 mechanism). NOTE: which fields are truly required comes
// from the OFFICIAL template (V-01); with the placeholder config this is provisional.
export function checkFieldCompleteness(
  fields: TemplateFieldConfig[],
  values: Record<string, unknown>,
): CompletenessResult {
  const missingRequired = fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.key];
      return v === undefined || v === null || String(v).trim() === "";
    })
    .map((f) => f.key);
  return { complete: missingRequired.length === 0, missingRequired };
}

// After filling, no delimiter-style placeholder should remain in the document text.
const UNRESOLVED_RE = /\{[^}]+\}/g;
export function findUnresolvedPlaceholders(documentText: string): string[] {
  return documentText.match(UNRESOLVED_RE) ?? [];
}

export interface FieldDiff {
  added: string[];
  removed: string[];
  changed: string[]; // required flag or control type or dbSource changed
}

// Diff two template versions' field sets (versioning/migration support, R-11).
export function diffTemplateFields(
  prev: TemplateFieldConfig[],
  next: TemplateFieldConfig[],
): FieldDiff {
  const prevByKey = new Map(prev.map((f) => [f.key, f]));
  const nextByKey = new Map(next.map((f) => [f.key, f]));
  const added = next.filter((f) => !prevByKey.has(f.key)).map((f) => f.key);
  const removed = prev.filter((f) => !nextByKey.has(f.key)).map((f) => f.key);
  const changed = next
    .filter((f) => {
      const p = prevByKey.get(f.key);
      return (
        p &&
        (p.required !== f.required || p.controlType !== f.controlType || p.dbSource !== f.dbSource)
      );
    })
    .map((f) => f.key);
  return { added, removed, changed };
}
