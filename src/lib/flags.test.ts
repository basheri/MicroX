import { describe, it, expect } from "vitest";
import { isFeatureEnabled } from "@/lib/flags";

describe("feature flags (EP-01)", () => {
  it("returns false by default when no flags are configured", () => {
    expect(isFeatureEnabled("market_analysis", "")).toBe(false);
    expect(isFeatureEnabled("market_analysis", undefined)).toBe(false);
  });

  it("reads enabled flags from a comma-separated list", () => {
    const raw = "market_analysis, question_bank";
    expect(isFeatureEnabled("market_analysis", raw)).toBe(true);
    expect(isFeatureEnabled("question_bank", raw)).toBe(true);
    expect(isFeatureEnabled("word_export", raw)).toBe(false);
  });
});
