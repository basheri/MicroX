import { describe, it, expect } from "vitest";
import {
  checkFieldCompleteness,
  findUnresolvedPlaceholders,
  diffTemplateFields,
} from "@/domain/templateFidelity";
import type { TemplateFieldConfig } from "@/config/templateConfig";

const f = (over: Partial<TemplateFieldConfig>): TemplateFieldConfig => ({
  key: "k",
  label: "l",
  required: false,
  controlType: "content_control",
  dbSource: "programs.name",
  ...over,
});

describe("template fidelity (EP-15)", () => {
  it("field completeness flags empty required fields", () => {
    const fields = [f({ key: "a", required: true }), f({ key: "b", required: false })];
    const r = checkFieldCompleteness(fields, { a: "", b: "" });
    expect(r.complete).toBe(false);
    expect(r.missingRequired).toEqual(["a"]);
    expect(checkFieldCompleteness(fields, { a: "x" }).complete).toBe(true);
  });

  it("detects unresolved placeholders in filled text", () => {
    expect(findUnresolvedPlaceholders("الاسم: {program_name}")).toEqual(["{program_name}"]);
    expect(findUnresolvedPlaceholders("الاسم: برنامج")).toEqual([]);
  });

  it("diffs field sets (added / removed / changed)", () => {
    const prev = [f({ key: "a", required: false }), f({ key: "b" })];
    const next = [f({ key: "a", required: true }), f({ key: "c" })];
    const diff = diffTemplateFields(prev, next);
    expect(diff.added).toEqual(["c"]);
    expect(diff.removed).toEqual(["b"]);
    expect(diff.changed).toEqual(["a"]); // required flag changed
  });
});
