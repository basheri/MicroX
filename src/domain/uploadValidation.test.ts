import { describe, it, expect } from "vitest";
import {
  validateUpload,
  sniffMime,
  UploadValidationError,
  MAX_UPLOAD_BYTES,
} from "@/domain/uploadValidation";

const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const PDF = bytes("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF");
const DOCX = bytes("PK................word/document.xml....");
const XLSX = bytes("PK................xl/workbook.xml....");

describe("upload validation (SEC-004)", () => {
  it("sniffs the real container type from magic bytes", () => {
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(DOCX)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(sniffMime(XLSX)).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(sniffMime(bytes("hello world"))).toBeNull();
  });

  it("accepts PDF / DOCX / XLSX when type, extension, and content agree", () => {
    expect(
      validateUpload(
        { originalName: "a.pdf", declaredMime: "application/pdf", sizeBytes: PDF.length },
        PDF,
      ),
    ).toBe("application/pdf");
    expect(
      validateUpload(
        {
          originalName: "a.docx",
          declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: DOCX.length,
        },
        DOCX,
      ),
    ).toContain("wordprocessingml");
  });

  it("rejects a disallowed type (e.g. text/plain)", () => {
    expect(() =>
      validateUpload(
        { originalName: "a.txt", declaredMime: "text/plain", sizeBytes: 5 },
        bytes("hello"),
      ),
    ).toThrow(UploadValidationError);
  });

  it("rejects an extension that does not match the declared type", () => {
    try {
      validateUpload(
        { originalName: "a.txt", declaredMime: "application/pdf", sizeBytes: PDF.length },
        PDF,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as UploadValidationError).code).toBe("ext_mismatch");
    }
  });

  it("rejects a spoofed MIME (declared DOCX, real PDF bytes)", () => {
    try {
      validateUpload(
        {
          originalName: "a.docx",
          declaredMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: PDF.length,
        },
        PDF,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as UploadValidationError).code).toBe("mime_spoof");
    }
  });

  it("rejects content whose signature is not PDF/DOCX/XLSX", () => {
    try {
      validateUpload(
        { originalName: "a.pdf", declaredMime: "application/pdf", sizeBytes: 5 },
        bytes("hello"),
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as UploadValidationError).code).toBe("magic_mismatch");
    }
  });

  it("rejects empty and oversize files", () => {
    expect(() =>
      validateUpload({ originalName: "a.pdf", declaredMime: "application/pdf", sizeBytes: 0 }, PDF),
    ).toThrow(/فارغ/);
    expect(() =>
      validateUpload(
        { originalName: "a.pdf", declaredMime: "application/pdf", sizeBytes: MAX_UPLOAD_BYTES + 1 },
        PDF,
      ),
    ).toThrow(/الحد الأقصى/);
  });
});
