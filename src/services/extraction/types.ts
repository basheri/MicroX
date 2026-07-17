// Extraction types (EP-05). A block is one extracted unit (a text region, a table, or
// an OCR'd region) carrying its page, location (bbox), confidence, and source class —
// mapping directly onto extracted_file_content.

export type SourceClass = "text" | "table" | "ocr";

export interface ExtractedBlock {
  pageNo: number | null;
  bbox: string | null; // serialized location, e.g. "x,y,w,h"; null when not applicable
  content: string;
  sourceClass: SourceClass;
  confidence: number; // 0..1
}

export interface ExtractInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface Extractor {
  extract(input: ExtractInput): Promise<ExtractedBlock[]>;
}

// OCR seam for scanned PDFs/images. Production wires tesseract.js or a cloud OCR here;
// OCR is exactly where low-confidence blocks originate (-> the TC-09 review gate).
export interface OcrEngine {
  recognize(bytes: Uint8Array): Promise<ExtractedBlock[]>;
}
