// @vitest-environment node
import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildXlsx } from "@/services/xlsx/xlsxWriter";

describe("xlsxWriter (EP-20) — minimal OOXML spreadsheet", () => {
  it("produces a valid .xlsx zip with the required parts and the data inline", () => {
    const bytes = buildXlsx("المؤشرات", [
      ["المرحلة", "العدد"],
      ["new", 3],
      ["export", 1],
    ]);

    // Real ZIP (PK header), not something else.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const files = unzipSync(bytes);
    expect(Object.keys(files)).toContain("[Content_Types].xml");
    expect(Object.keys(files)).toContain("xl/workbook.xml");
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");

    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain('rightToLeft="1"'); // Arabic RTL sheet
    expect(sheet).toContain("المرحلة"); // inline string cell
    expect(sheet).toContain("<v>3</v>"); // numeric cell
  });

  it("escapes XML-special characters in string cells", () => {
    const files = unzipSync(buildXlsx("s", [['a<b>&"c']]));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("a&lt;b&gt;&amp;&quot;c");
  });

  it("computes column references beyond Z (AA, AB)", () => {
    const wide = Array.from({ length: 28 }, (_, i) => i);
    const files = unzipSync(buildXlsx("s", [wide]));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain('r="AA1"');
    expect(sheet).toContain('r="AB1"');
  });
});
