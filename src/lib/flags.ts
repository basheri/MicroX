// Data-driven feature flags (EP-01 + D-08 spirit: behaviour configurable, no rebuild).
// v1 source is the NEXT_PUBLIC_FEATURE_FLAGS env var (comma-separated keys).
// Later epics can back this with `application_settings` in the DB without changing callers.

export type FeatureFlag =
  | "market_analysis"
  | "program_generator"
  | "question_bank"
  | "word_export"
  | "compliance_engine"
  | "quality_engine"
  | "center_feedback"
  | "versioning"
  | "dashboard"
  | "export_package";

function parseFlags(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Reads from the environment at call time so tests can override via the arg.
export function isFeatureEnabled(
  flag: FeatureFlag,
  rawFlags: string | undefined = process.env.NEXT_PUBLIC_FEATURE_FLAGS,
): boolean {
  return parseFlags(rawFlags).has(flag);
}
