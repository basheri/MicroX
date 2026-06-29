import { describe, it, expect } from "vitest";
import {
  STAGES,
  isStage,
  nextStage,
  isStructureGated,
  completionPctForStage,
} from "@/domain/stages";

describe("stage machine (SC-05)", () => {
  it("has the 14 defined stages in order, matching the schema CHECK", () => {
    expect(STAGES).toHaveLength(14);
    expect(STAGES[0]).toBe("new");
    expect(STAGES[STAGES.length - 1]).toBe("export");
  });

  it("validates stage codes", () => {
    expect(isStage("market")).toBe(true);
    expect(isStage("bogus")).toBe(false);
  });

  it("advances linearly and stops at the final stage", () => {
    expect(nextStage("new")).toBe("sources");
    expect(nextStage("compliance")).toBe("export");
    expect(nextStage("export")).toBeNull();
  });

  it("gates structure at compliance and export only", () => {
    expect(isStructureGated("compliance")).toBe(true);
    expect(isStructureGated("export")).toBe(true);
    expect(isStructureGated("structure")).toBe(false);
    expect(isStructureGated("new")).toBe(false);
  });

  it("computes stage-driven completion percentage (0 at new, 100 at export)", () => {
    expect(completionPctForStage("new")).toBe(0);
    expect(completionPctForStage("export")).toBe(100);
    expect(completionPctForStage("courses")).toBeGreaterThan(0);
  });
});
