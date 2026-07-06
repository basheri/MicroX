// References domain (EP-14 / AI-004). PURE. A reference must carry a verifiable
// identifier (DOI or URL) to be checked for existence; a citation with none cannot be
// verified and is flagged (never silently included).

export const REFERENCE_LANGUAGES = ["ar", "en"] as const;
export type RefLanguage = (typeof REFERENCE_LANGUAGES)[number];

export function isRefLanguage(value: string): value is RefLanguage {
  return (REFERENCE_LANGUAGES as readonly string[]).includes(value);
}

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/;
const URL_RE = /https?:\/\/[^\s)]+/;

export interface Identifier {
  kind: "doi" | "url" | null;
  value: string | null;
}

// Extract a resolvable identifier from a citation. DOI wins over a bare URL.
export function extractIdentifier(citation: string): Identifier {
  const doi = citation.match(DOI_RE);
  if (doi) return { kind: "doi", value: doi[0] };
  const url = citation.match(URL_RE);
  if (url) return { kind: "url", value: url[0].replace(/[.,)]+$/, "") };
  return { kind: null, value: null };
}
