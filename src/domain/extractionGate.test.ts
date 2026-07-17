import { describe, it, expect } from "vitest";
import {
  isUsable,
  needsReview,
  isLowConfidence,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/domain/extractionGate";

// TC-09 gate logic (AI-005), unit-level. The DB enforcement mirrors this (see ep05.it.test).
describe("extraction confidence gate (TC-09)", () => {
  it("blocks low-confidence content with no review", () => {
    expect(isUsable({ confidence: 0.4, reviewStatus: null })).toBe(false);
    expect(needsReview({ confidence: 0.4, reviewStatus: null })).toBe(true);
  });

  it("allows high-confidence content without review", () => {
    expect(isUsable({ confidence: 0.95, reviewStatus: null })).toBe(true);
    expect(needsReview({ confidence: 0.95, reviewStatus: null })).toBe(false);
  });

  it("allows low-confidence content once approved or corrected", () => {
    expect(isUsable({ confidence: 0.2, reviewStatus: "approved" })).toBe(true);
    expect(isUsable({ confidence: 0.2, reviewStatus: "corrected" })).toBe(true);
    expect(needsReview({ confidence: 0.2, reviewStatus: "approved" })).toBe(false);
  });

  it("keeps rejected content unusable even if reviewed", () => {
    expect(isUsable({ confidence: 0.9, reviewStatus: "rejected" })).toBe(false);
  });

  it("treats the threshold boundary as usable", () => {
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD)).toBe(false);
    expect(isUsable({ confidence: LOW_CONFIDENCE_THRESHOLD, reviewStatus: null })).toBe(true);
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD - 0.01)).toBe(true);
  });
});
