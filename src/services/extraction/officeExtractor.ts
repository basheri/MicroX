// Real text/table extraction for DOCX & XLSX (EP-05). These are OOXML (ZIP) files with
// digital text, so extraction is deterministic and high-confidence (no OCR needed).
// Uses fflate to unzip; pulls text from the relevant inner XML parts.

import { unzipSync, strFromU8 } from "fflate";
import type { ExtractedBlock, ExtractInput, Extractor } from "@/services/extraction/types";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Digital office text is reliable -> high confidence.
const DIGITAL_CONFIDENCE = 1.0;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Pull the inner text of all <tag>…</tag> occurrences (namespace-aware: matches w:t, t, …).
function textOfTags(xml: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${localName}>`,
    "g",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(decodeXmlEntities(m[1]!.replace(/<[^>]+>/g, "")));
  }
  return out;
}

function extractDocx(files: Record<string, Uint8Array>): ExtractedBlock[] {
  const doc = files["word/document.xml"];
  if (!doc) return [];
  const xml = strFromU8(doc);
  // Each paragraph <w:p> becomes a block; its text is the concatenation of its <w:t> runs.
  const paragraphs = xml.split(/<\/w:p>/).map((p) => textOfTags(p, "t").join(""));
  const blocks: ExtractedBlock[] = [];
  let order = 0;
  for (const para of paragraphs) {
    const text = para.trim();
    if (!text) continue;
    blocks.push({
      pageNo: null, // Word has no fixed page model pre-render
      bbox: `p:${order}`,
      content: text,
      sourceClass: "text",
      confidence: DIGITAL_CONFIDENCE,
    });
    order += 1;
  }
  return blocks;
}

function extractXlsx(files: Record<string, Uint8Array>): ExtractedBlock[] {
  // Shared strings hold most cell text; each becomes a table cell block.
  const shared = files["xl/sharedStrings.xml"];
  const blocks: ExtractedBlock[] = [];
  if (shared) {
    const cells = textOfTags(strFromU8(shared), "t");
    cells.forEach((cell, i) => {
      const text = cell.trim();
      if (!text) return;
      blocks.push({
        pageNo: null,
        bbox: `s:${i}`,
        content: text,
        sourceClass: "table",
        confidence: DIGITAL_CONFIDENCE,
      });
    });
  }
  return blocks;
}

export class OfficeExtractor implements Extractor {
  async extract(input: ExtractInput): Promise<ExtractedBlock[]> {
    const files = unzipSync(input.bytes);
    if (input.mimeType === DOCX_MIME) return extractDocx(files);
    if (input.mimeType === XLSX_MIME) return extractXlsx(files);
    return [];
  }
}
