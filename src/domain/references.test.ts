import { describe, it, expect } from "vitest";
import { extractIdentifier, isRefLanguage } from "@/domain/references";

describe("reference identifiers (AI-004)", () => {
  it("extracts a DOI (preferred over a URL)", () => {
    const id = extractIdentifier("Smith, J. (2020). Title. https://x.com doi:10.1000/abc.123");
    expect(id.kind).toBe("doi");
    expect(id.value).toBe("10.1000/abc.123");
  });
  it("extracts a URL when there is no DOI", () => {
    const id = extractIdentifier("مرجع على https://example.gov.sa/report.");
    expect(id.kind).toBe("url");
    expect(id.value).toBe("https://example.gov.sa/report");
  });
  it("returns none for a citation with no resolvable identifier", () => {
    expect(extractIdentifier("مرجع مُختلَق بلا معرّف").kind).toBeNull();
  });
  it("validates languages", () => {
    expect(isRefLanguage("ar")).toBe(true);
    expect(isRefLanguage("fr")).toBe(false);
  });
});
