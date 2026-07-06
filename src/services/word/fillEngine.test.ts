// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildPlaceholderDocx } from "@/services/word/placeholderTemplate";
import {
  fillDocxTemplate,
  readDocxText,
  assertDocx,
  NotADocxError,
} from "@/services/word/fillEngine";
import { findUnresolvedPlaceholders } from "@/domain/templateFidelity";

const FIELDS = [
  { key: "program_name", label: "اسم البرنامج" },
  { key: "sector", label: "القطاع" },
];

describe("Word fill engine (D-04 / rule 60 — never HTML->Word)", () => {
  it("fills the ORIGINAL .docx template's placeholders and stays a valid .docx", () => {
    const template = buildPlaceholderDocx(FIELDS);
    const filled = fillDocxTemplate(template, { program_name: "برنامج الأمن", sector: "التقنية" });

    // Output is still a real .docx (PK zip), not HTML.
    expect(filled[0]).toBe(0x50);
    expect(filled[1]).toBe(0x4b);
    expect(() => assertDocx(filled)).not.toThrow();

    const text = readDocxText(filled);
    expect(text).toContain("برنامج الأمن");
    expect(text).toContain("التقنية");
    // No placeholder left unresolved (fidelity).
    expect(findUnresolvedPlaceholders(text)).toEqual([]);
  });

  it("leaves unknown fields empty without breaking the document", () => {
    const template = buildPlaceholderDocx(FIELDS);
    const filled = fillDocxTemplate(template, { program_name: "x" });
    expect(findUnresolvedPlaceholders(readDocxText(filled))).toEqual([]);
  });

  it("REJECTS HTML input (never HTML->Word)", () => {
    const html = new Uint8Array(Buffer.from("<html><body><h1>ليس Word</h1></body></html>", "utf8"));
    expect(() => assertDocx(html)).toThrow(NotADocxError);
    expect(() => fillDocxTemplate(html, {})).toThrow(NotADocxError);
  });
});
