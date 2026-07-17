// Reference existence/metadata verification (EP-14 / AI-004). Behind an interface so
// it is testable without live network — production resolves DOIs/URLs over HTTP; tests
// inject a fake. A citation with no resolvable identifier, or one that does not resolve,
// is reported as NOT existing and gets flagged (never silently accepted).

import { extractIdentifier } from "@/domain/references";
import type { HttpClient, HttpResponse } from "@/services/llm/types";

export interface VerificationResult {
  exists: boolean;
  note: string;
}

export interface ReferenceVerifier {
  verify(citation: string): Promise<VerificationResult>;
}

const defaultHttp: HttpClient = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<HttpResponse>;

export class HttpReferenceVerifier implements ReferenceVerifier {
  constructor(private readonly http: HttpClient = defaultHttp) {}

  async verify(citation: string): Promise<VerificationResult> {
    const id = extractIdentifier(citation);
    if (!id.value) {
      return {
        exists: false,
        note: "لا يوجد معرّف قابل للتحقق (DOI أو رابط) — مرجع غير قابل للتوثيق.",
      };
    }
    const url = id.kind === "doi" ? `https://doi.org/${id.value}` : id.value;
    try {
      const res = await this.http(url, { method: "GET" });
      if (res.ok) return { exists: true, note: `تم التحقق من وجود المرجع (${id.kind}).` };
      return { exists: false, note: `تعذّر التحقق من المرجع (HTTP ${res.status}).` };
    } catch (err) {
      return { exists: false, note: `خطأ أثناء التحقق: ${(err as Error).message}` };
    }
  }
}

export const defaultReferenceVerifier: ReferenceVerifier = new HttpReferenceVerifier();
