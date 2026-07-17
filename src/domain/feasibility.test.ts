import { describe, it, expect } from "vitest";
import {
  validateFeasibility,
  isWeakRating,
  FeasibilityValidationError,
} from "@/domain/feasibility";

describe("feasibility rating (EP-08)", () => {
  it("classifies weak ratings", () => {
    expect(isWeakRating("low")).toBe(true);
    expect(isWeakRating("insufficient_evidence")).toBe(true);
    expect(isWeakRating("medium")).toBe(false);
    expect(isWeakRating("high")).toBe(false);
  });

  it("requires a justification for a weak rating", () => {
    expect(() => validateFeasibility({ rating: "low" })).toThrow(FeasibilityValidationError);
    expect(() =>
      validateFeasibility({ rating: "insufficient_evidence", justification: "  " }),
    ).toThrow();
    expect(validateFeasibility({ rating: "low", justification: "سوق ناشئ لكنه واعد" })).toBe("low");
  });

  it("does not require a justification for a strong rating", () => {
    expect(validateFeasibility({ rating: "high" })).toBe("high");
    expect(validateFeasibility({ rating: "medium" })).toBe("medium");
  });

  it("rejects an invalid rating", () => {
    expect(() => validateFeasibility({ rating: "amazing" })).toThrow(/غير صالح/);
  });
});
