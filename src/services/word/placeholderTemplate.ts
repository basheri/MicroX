// Placeholder .docx builder (EP-15). Produces a REAL OOXML .docx (a ZIP with
// word/document.xml) whose text carries `{field_key}` tags for the fill engine.
//
// ⛔ PLACEHOLDER: stands in for the official template until it is provided (V-01/V-06).
// The real template is uploaded as a template_version file and filled the same way.

import { zipSync, strToU8 } from "fflate";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

// Build a docx with one RTL paragraph per field: "<label>: {<key>}".
export function buildPlaceholderDocx(fields: { key: string; label: string }[]): Uint8Array {
  const paragraphs = fields
    .map(
      (f) =>
        `<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:t xml:space="preserve">${f.label}: {${f.key}}</w:t></w:r></w:p>`,
    )
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;

  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(documentXml),
    "word/_rels/document.xml.rels": strToU8(DOC_RELS),
  });
}
