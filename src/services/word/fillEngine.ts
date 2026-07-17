// Word fill engine (EP-15 / D-04 / rule 60). Fills the ORIGINAL .docx template by
// injecting values into its existing placeholders via docxtemplater/OOXML.
// NEVER HTML->Word: the input MUST be a real .docx (a ZIP); HTML input is rejected.

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { unzipSync, strFromU8 } from "fflate";

export class NotADocxError extends Error {
  constructor() {
    super("القالب ليس ملف DOCX صالحًا. غير مسموح بتحويل HTML إلى Word (rule 60 / D-04).");
    this.name = "NotADocxError";
  }
}

// A .docx is a ZIP archive: it starts with the "PK" signature and contains
// word/document.xml. Anything else (e.g. HTML) is refused.
export function assertDocx(bytes: Uint8Array): void {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) throw new NotADocxError();
  try {
    const files = unzipSync(bytes);
    if (!files["word/document.xml"]) throw new NotADocxError();
  } catch {
    throw new NotADocxError();
  }
}

// Fill the template's existing placeholders with values. Returns a new .docx (never HTML).
export function fillDocxTemplate(
  templateBytes: Uint8Array,
  values: Record<string, string>,
): Uint8Array {
  assertDocx(templateBytes);
  const zip = new PizZip(Buffer.from(templateBytes));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // unknown tags render empty; completeness is checked separately
  });
  doc.render(values);
  return doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
}

// Extract the plain text of a .docx's document body (for fidelity assertions).
export function readDocxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) return "";
  return strFromU8(doc).replace(/<[^>]+>/g, "");
}
