import { describe, it, expect } from "vitest";
import { assessQuality, type QualityFacts, type LlmAxisResult } from "@/domain/qualityEngine";
import { DEFAULT_QUALITY_CONFIG } from "@/config/qualityConfig";

const HIGH: QualityFacts = {
  ploTotal: 4,
  ploUncovered: 0,
  cloTotal: 8,
  cloUncovered: 0,
  unitsTotal: 10,
  unitsUnaligned: 0,
  questionsTotal: 20,
  questionsUnlinked: 0,
  verifiedReferences: 3,
};

const LOW: QualityFacts = {
  ploTotal: 4,
  ploUncovered: 3,
  cloTotal: 8,
  cloUncovered: 6,
  unitsTotal: 10,
  unitsUnaligned: 7,
  questionsTotal: 20,
  questionsUnlinked: 15,
  verifiedReferences: 0,
};

const EMPTY: QualityFacts = {
  ploTotal: 0,
  ploUncovered: 0,
  cloTotal: 0,
  cloUncovered: 0,
  unitsTotal: 0,
  unitsUnaligned: 0,
  questionsTotal: 0,
  questionsUnlinked: 0,
  verifiedReferences: 0,
};

const goodLlm: LlmAxisResult = { score: 90, confidence: "high", rationale: "واضحة" };

describe("qualityEngine (EP-17 / SC-19) — pure six-axis scoring", () => {
  it("scores a complete high-quality program near the top with no warnings", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, HIGH, goodLlm);
    expect(r.overall).toBeGreaterThanOrEqual(95);
    expect(r.warnings).toHaveLength(0);
    expect(r.axes).toHaveLength(6);
  });

  it("scores a low-quality program low and raises warnings", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, LOW, {
      score: 40,
      confidence: "low",
      rationale: "غامضة",
    });
    expect(r.overall).toBeLessThan(50);
    expect(r.warnings.length).toBeGreaterThan(0);
    // Gaps are traceable in the evidence.
    const plo = r.axes.find((a) => a.key === "plo_coverage")!;
    expect(plo.evidence.join(" ")).toContain("3");
  });

  it("NEVER blocks export regardless of how low the scores are (BR-019)", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, LOW, null);
    expect(r.blocksExport).toBe(false);
  });

  it("handles an empty dataset explicitly (insufficient data, not a silent zero-pass)", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, EMPTY, null);
    const plo = r.axes.find((a) => a.key === "plo_coverage")!;
    expect(plo.insufficientData).toBe(true);
    expect(plo.isWarning).toBe(true);
    expect(plo.evidence.join(" ")).toContain("لا توجد");
  });

  it("reports the LLM axis as insufficient when no result is provided (no fake score)", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, HIGH, null);
    const clarity = r.axes.find((a) => a.key === "outcome_clarity")!;
    expect(clarity.insufficientData).toBe(true);
    expect(clarity.confidence).toBeNull();
    // Overall still computed from the axes that DID have data.
    expect(r.overall).toBeGreaterThan(0);
  });

  it("carries a confidence level on the LLM-assisted axis (AI-005)", () => {
    const r = assessQuality(DEFAULT_QUALITY_CONFIG, HIGH, goodLlm);
    const clarity = r.axes.find((a) => a.key === "outcome_clarity")!;
    expect(clarity.confidence).toBe("high");
  });

  it("throws on an invalid (empty) axis configuration rather than scoring nonsense", () => {
    expect(() => assessQuality({ axes: [] }, HIGH, null)).toThrow(/no axes/);
  });

  it("is boundary-aware: exactly-at-threshold coverage does not warn, just-below does", () => {
    // content_alignment warns below 90. 9/10 aligned = 90 -> no warning.
    const atThreshold = assessQuality(
      DEFAULT_QUALITY_CONFIG,
      { ...HIGH, unitsTotal: 10, unitsUnaligned: 1 },
      goodLlm,
    ).axes.find((a) => a.key === "content_alignment")!;
    expect(atThreshold.score).toBe(90);
    expect(atThreshold.isWarning).toBe(false);

    // 8/10 = 80 -> below 90 -> warning.
    const below = assessQuality(
      DEFAULT_QUALITY_CONFIG,
      { ...HIGH, unitsTotal: 10, unitsUnaligned: 2 },
      goodLlm,
    ).axes.find((a) => a.key === "content_alignment")!;
    expect(below.score).toBe(80);
    expect(below.isWarning).toBe(true);
  });
});
