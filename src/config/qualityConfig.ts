// =====================================================================
// QUALITY CONFIG — the tunable definition of the six quality axes (EP-17 / SC-19).
//
// These are OPERATIONAL scoring parameters (axis taxonomy, weights, warn thresholds),
// NOT invented academic/regulatory thresholds like the BR-xxx values. They are
// deliberately editable: if the official guide defines a quality policy, adjust ONLY
// this file — the engine, persistence, UI, and tests read the axes from here.
//
// The deterministic axes are grounded in the spec's alignment chain (BR-015..018 /
// TC-06). One axis is LLM-assisted (qualitative) and carries a confidence level
// (AI-005). Quality is ADVISORY: a low axis raises a warning and NEVER blocks export.
// =====================================================================

export type AxisKind = "deterministic" | "llm_assist";

// Deterministic detector keys the engine knows how to score from QualityFacts.
export type DetectorKey =
  | "plo_coverage"
  | "clo_coverage"
  | "content_alignment"
  | "assessment_linkage"
  | "reference_support";

export interface QualityAxisConfig {
  key: string;
  label: string; // Arabic (SC-19)
  kind: AxisKind;
  weight: number; // relative weight in the overall score (normalized at runtime)
  warnBelow: number; // score (0–100) below which the axis raises a warning
  detector?: DetectorKey; // deterministic axes only
  description: string;
}

export interface QualityConfig {
  axes: QualityAxisConfig[];
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  axes: [
    {
      key: "plo_coverage",
      label: "تغطية مخرجات البرنامج (PLO)",
      kind: "deterministic",
      weight: 0.2,
      warnBelow: 100, // every PLO must be covered by the alignment chain (TC-06)
      detector: "plo_coverage",
      description: "نسبة مخرجات تعلّم البرنامج المرتبطة بسلسلة المواءمة (BR-015..018).",
    },
    {
      key: "clo_coverage",
      label: "تغطية مخرجات المقررات (CLO)",
      kind: "deterministic",
      weight: 0.2,
      warnBelow: 100,
      detector: "clo_coverage",
      description: "نسبة مخرجات تعلّم المقررات المرتبطة بالمواءمة.",
    },
    {
      key: "content_alignment",
      label: "مواءمة المحتوى",
      kind: "deterministic",
      weight: 0.2,
      warnBelow: 90,
      detector: "content_alignment",
      description: "نسبة وحدات المحتوى المرتبطة بمخرج تعلّم.",
    },
    {
      key: "assessment_linkage",
      label: "ارتباط التقييم بالمخرجات",
      kind: "deterministic",
      weight: 0.2,
      warnBelow: 90,
      detector: "assessment_linkage",
      description: "نسبة أسئلة بنك الأسئلة المرتبطة بمخرج تعلّم (CLO).",
    },
    {
      key: "reference_support",
      label: "الإسناد المرجعي",
      kind: "deterministic",
      weight: 0.1,
      warnBelow: 100,
      detector: "reference_support",
      description: "توفّر مرجع واحد موثّق على الأقل يدعم البرنامج.",
    },
    {
      key: "outcome_clarity",
      label: "وضوح صياغة المخرجات (تقييم لغوي مُعزَّز)",
      kind: "llm_assist",
      weight: 0.1,
      warnBelow: 70,
      description:
        "تقييم كيفي مُعزَّز بالنموذج لوضوح صياغة المخرجات، مع درجة ثقة (AI-005). استشاري فقط.",
    },
  ],
};

export function activeQualityConfig(): QualityConfig {
  return DEFAULT_QUALITY_CONFIG;
}
