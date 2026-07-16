// Quality engine (EP-17 / SC-19) — PURE and framework-free. Computes six-axis quality
// scores from a bag of program FACTS + one optional LLM-assisted result, applies the
// configured weights, and produces per-axis + overall scores with traceable evidence.
//
// Quality is ADVISORY (BR-019): a low axis raises a WARNING, never a blocking error.
// The export gate is compliance-only — nothing here blocks export.

import type { QualityConfig, QualityAxisConfig, DetectorKey } from "@/config/qualityConfig";

// Plain numeric facts the deterministic detectors read (no DB knowledge here).
export interface QualityFacts {
  ploTotal: number;
  ploUncovered: number;
  cloTotal: number;
  cloUncovered: number;
  unitsTotal: number;
  unitsUnaligned: number;
  questionsTotal: number;
  questionsUnlinked: number;
  verifiedReferences: number;
}

export type Confidence = "low" | "medium" | "high";

// The LLM-assisted axis result, produced by the service via LLMProvider (or null when
// not assessed — e.g. no provider available). Score 0–100 + a confidence level (AI-005).
export interface LlmAxisResult {
  score: number;
  confidence: Confidence;
  rationale: string;
}

export interface AxisScore {
  key: string;
  label: string;
  kind: QualityAxisConfig["kind"];
  weight: number; // normalized
  score: number; // 0–100
  confidence: Confidence | null;
  isWarning: boolean; // score < warnBelow
  insufficientData: boolean; // no data to assess this axis
  evidence: string[]; // traceable reasons/gaps (Arabic)
}

export interface QualityResult {
  axes: AxisScore[];
  overall: number; // 0–100 weighted
  warnings: AxisScore[]; // axes below their warn threshold
  blocksExport: false; // invariant: quality NEVER blocks export (BR-019)
}

// covered/total → percentage, with explicit "insufficient data" when total is 0.
function coverageScore(total: number, gap: number): { score: number; insufficient: boolean } {
  if (total <= 0) return { score: 0, insufficient: true };
  const covered = Math.max(0, total - gap);
  return { score: Math.round((100 * covered) / total), insufficient: false };
}

function scoreDeterministic(
  detector: DetectorKey,
  f: QualityFacts,
): { score: number; insufficient: boolean; evidence: string[] } {
  switch (detector) {
    case "plo_coverage": {
      const r = coverageScore(f.ploTotal, f.ploUncovered);
      return {
        ...r,
        evidence: r.insufficient
          ? ["لا توجد مخرجات برنامج لتقييمها."]
          : f.ploUncovered > 0
            ? [`${f.ploUncovered} من ${f.ploTotal} مخرج برنامج غير مغطّى بالمواءمة.`]
            : [],
      };
    }
    case "clo_coverage": {
      const r = coverageScore(f.cloTotal, f.cloUncovered);
      return {
        ...r,
        evidence: r.insufficient
          ? ["لا توجد مخرجات مقررات لتقييمها."]
          : f.cloUncovered > 0
            ? [`${f.cloUncovered} من ${f.cloTotal} مخرج مقرر غير مغطّى بالمواءمة.`]
            : [],
      };
    }
    case "content_alignment": {
      const r = coverageScore(f.unitsTotal, f.unitsUnaligned);
      return {
        ...r,
        evidence: r.insufficient
          ? ["لا توجد وحدات محتوى لتقييمها."]
          : f.unitsUnaligned > 0
            ? [`${f.unitsUnaligned} من ${f.unitsTotal} وحدة محتوى غير مرتبطة بمخرج.`]
            : [],
      };
    }
    case "assessment_linkage": {
      const r = coverageScore(f.questionsTotal, f.questionsUnlinked);
      return {
        ...r,
        evidence: r.insufficient
          ? ["لا توجد أسئلة لتقييمها."]
          : f.questionsUnlinked > 0
            ? [`${f.questionsUnlinked} من ${f.questionsTotal} سؤال غير مرتبط بمخرج (CLO).`]
            : [],
      };
    }
    case "reference_support": {
      const ok = f.verifiedReferences >= 1;
      return {
        score: ok ? 100 : 0,
        insufficient: false,
        evidence: ok ? [] : ["لا يوجد مرجع موثّق واحد على الأقل."],
      };
    }
    default:
      // Unknown detector: fail-safe to insufficient rather than a silent perfect score.
      return { score: 0, insufficient: true, evidence: ["مُقيِّم غير معروف."] };
  }
}

export function assessQuality(
  config: QualityConfig,
  facts: QualityFacts,
  llm: LlmAxisResult | null,
): QualityResult {
  if (!config.axes.length) throw new Error("qualityEngine: no axes configured.");

  const axes: AxisScore[] = config.axes.map((a): AxisScore => {
    if (a.kind === "llm_assist") {
      const score = llm ? clamp(llm.score) : 0;
      const insufficient = llm === null;
      return {
        key: a.key,
        label: a.label,
        kind: a.kind,
        weight: a.weight,
        score,
        confidence: llm?.confidence ?? null,
        isWarning: insufficient || score < a.warnBelow,
        insufficientData: insufficient,
        evidence: llm ? [llm.rationale] : ["لم يُجرَ التقييم المُعزَّز (لا يوجد مزوّد نموذج)."],
      };
    }
    const det = scoreDeterministic(a.detector!, facts);
    return {
      key: a.key,
      label: a.label,
      kind: a.kind,
      weight: a.weight,
      score: det.score,
      confidence: null,
      isWarning: det.insufficient || det.score < a.warnBelow,
      insufficientData: det.insufficient,
      evidence: det.evidence,
    };
  });

  // Normalize weights over axes that had data, so "insufficient" axes don't silently
  // drag the overall to zero; they still surface as warnings.
  const scored = axes.filter((a) => !a.insufficientData);
  const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
  const overall =
    totalWeight > 0
      ? Math.round(scored.reduce((s, a) => s + a.score * (a.weight / totalWeight), 0))
      : 0;

  // Reflect normalized weights back for transparency.
  for (const a of axes)
    a.weight = totalWeight > 0 ? Number((a.weight / totalWeight).toFixed(4)) : 0;

  return {
    axes,
    overall,
    warnings: axes.filter((a) => a.isWarning),
    blocksExport: false,
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
