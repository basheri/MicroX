// @vitest-environment node
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { OfficeExtractor } from "@/services/extraction/officeExtractor";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function docx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  const xml = `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>${body}</w:body></w:document>`;
  return zipSync({ "word/document.xml": strToU8(xml) });
}

function xlsx(cells: string[]): Uint8Array {
  const sst = `<sst>${cells.map((c) => `<si><t>${c}</t></si>`).join("")}</sst>`;
  return zipSync({ "xl/sharedStrings.xml": strToU8(sst) });
}

describe("OfficeExtractor (EP-05 real extraction)", () => {
  it("extracts DOCX paragraphs as high-confidence text blocks", async () => {
    const blocks = await new OfficeExtractor().extract({
      bytes: docx(["مرحبا بالعالم", "سطر ثانٍ"]),
      mimeType: DOCX_MIME,
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.content).toBe("مرحبا بالعالم");
    expect(blocks[0]!.sourceClass).toBe("text");
    expect(blocks[0]!.confidence).toBe(1);
  });

  it("extracts XLSX shared strings as table cells", async () => {
    const blocks = await new OfficeExtractor().extract({
      bytes: xlsx(["القيمة الأولى", "Value 2"]),
      mimeType: XLSX_MIME,
    });
    expect(blocks.map((b) => b.content)).toEqual(["القيمة الأولى", "Value 2"]);
    expect(blocks.every((b) => b.sourceClass === "table")).toBe(true);
  });
});

export { docx, xlsx };
