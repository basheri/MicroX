// @vitest-environment node
//
// CI GUARD (rule 60 / rule 70): Word output must fill the ORIGINAL template via
// docxtemplater/OOXML — NEVER HTML->Word. This test fails the build if a forbidden
// HTML-to-Word library is added, or if the fill engine stops using docxtemplater.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Names of libraries that convert HTML into Word documents — forbidden (D-04).
const BANNED =
  /html[-_]?to[-_]?docx|html[-_]?docx[-_]?js|htmldocx|html2docx|word[-_]?from[-_]?html/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".guard.test.ts")) acc.push(p);
  }
  return acc;
}

describe("no HTML->Word guard (D-04 / rule 60)", () => {
  it("has no HTML-to-Word dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    const offenders = names.filter((n) => BANNED.test(n));
    expect(offenders).toEqual([]);
  });

  it("no source file references an HTML-to-Word library", () => {
    const offenders = walk("src").filter((file) => BANNED.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the fill engine uses docxtemplater on a real .docx (not HTML)", () => {
    const engine = readFileSync("src/services/word/fillEngine.ts", "utf8");
    expect(engine).toContain("docxtemplater");
    expect(engine).toContain("assertDocx"); // rejects non-docx (HTML) input
  });
});
