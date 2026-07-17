import { describe, it, expect } from "vitest";
import { impactedSections, isSectionKey, SECTION_KEYS } from "@/domain/generation/sections";

describe("generation impact map (EP-09)", () => {
  it("includes the changed section and its downstream dependencies", () => {
    const impacted = impactedSections("outcomes");
    expect(impacted).toContain("outcomes");
    expect(impacted).toContain("courses");
    expect(impacted).toContain("questions");
    // outcomes does not affect references in our chain
    expect(impacted).not.toContain("references");
  });

  it("a leaf section affects only itself", () => {
    expect(impactedSections("questions")).toEqual(["questions"]);
  });

  it("program_structure affects everything downstream", () => {
    const impacted = impactedSections("program_structure");
    for (const k of SECTION_KEYS) expect(impacted).toContain(k);
  });

  it("validates section keys", () => {
    expect(isSectionKey("courses")).toBe(true);
    expect(isSectionKey("nope")).toBe(false);
  });
});
