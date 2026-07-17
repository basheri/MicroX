// Safe-upload validation (SEC-004 / rule 00). Accept ONLY PDF / DOCX / XLSX, verified
// by BOTH the declared type AND the real file signature (magic bytes), plus a size cap.
// PURE — no I/O — so it is fully unit-testable.

export const ALLOWED = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    label: "DOCX",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    ext: "xlsx",
    label: "XLSX",
  },
} as const;

export type AllowedMime = keyof typeof ALLOWED;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadMeta {
  originalName: string;
  declaredMime: string;
  sizeBytes: number;
}

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

// Detect the true container from magic bytes and (for ZIP/OOXML) inner entry names.
// Returns the matching allowed MIME, or null if it is not a PDF/DOCX/XLSX.
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  // PDF: "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  // OOXML (docx/xlsx) are ZIP: "PK\x03\x04". Distinguish by inner entry names, which
  // appear literally in the ZIP local file headers.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
    if (head.includes("word/")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (head.includes("xl/")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
  }
  return null;
}

// Throws UploadValidationError on any violation; otherwise returns the verified MIME.
export function validateUpload(meta: UploadMeta, bytes: Uint8Array): AllowedMime {
  if (meta.sizeBytes <= 0) {
    throw new UploadValidationError("الملف فارغ.", "empty");
  }
  if (meta.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      `حجم الملف يتجاوز الحد الأقصى (${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} ميجابايت).`,
      "too_large",
    );
  }
  if (!(meta.declaredMime in ALLOWED)) {
    throw new UploadValidationError(
      "نوع الملف غير مسموح. المسموح: PDF أو DOCX أو XLSX فقط.",
      "type_not_allowed",
    );
  }
  const declared = meta.declaredMime as AllowedMime;
  if (extOf(meta.originalName) !== ALLOWED[declared].ext) {
    throw new UploadValidationError("امتداد الملف لا يطابق نوعه المعلن.", "ext_mismatch");
  }
  const actual = sniffMime(bytes);
  if (actual === null) {
    throw new UploadValidationError(
      "محتوى الملف لا يطابق نوع PDF/DOCX/XLSX (فحص التوقيع الحقيقي).",
      "magic_mismatch",
    );
  }
  if (actual !== declared) {
    throw new UploadValidationError("نوع الملف المعلن لا يطابق محتواه الحقيقي.", "mime_spoof");
  }
  return declared;
}
