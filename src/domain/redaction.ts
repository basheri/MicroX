// Redaction pipeline (SEC-006 / rule 00). PURE + deterministic. Strips personal data
// — names, national IDs, emails, phone numbers — from any text BEFORE it can be sent
// to the model. Returns the cleaned text plus per-category counts for redaction_logs.
//
// This is a deterministic safety net, not NER: it catches structured PII (email/phone/
// ID) by pattern and names by honorific patterns + an explicit known-names list. Richer
// name detection can be layered in later behind the same interface.

export type RedactionEntity = "name" | "national_id" | "email" | "phone";

export const REDACTION_TOKENS: Record<RedactionEntity, string> = {
  email: "⟦بريد⟧",
  phone: "⟦هاتف⟧",
  national_id: "⟦هوية⟧",
  name: "⟦اسم⟧",
};

export interface RedactionResult {
  text: string;
  counts: Record<RedactionEntity, number>;
  total: number;
}

// --- Patterns (order matters: email -> phone -> id -> names) ---
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Saudi mobile, optionally with +966 / 00966 / leading 0, then 5 + 8 digits.
const SAUDI_PHONE = /(?:(?:\+|00)966[\s-]?|0)5\d{8}/g;
// Other international numbers in +CC… form.
const INTL_PHONE = /\+\d{7,15}/g;
// Saudi national ID / Iqama: 10 digits starting with 1 or 2 (not part of a longer run).
const NATIONAL_ID = /(?<!\d)[12]\d{9}(?!\d)/g;

// Honorific-led names. Over-redaction (dropping the title too) is safe.
const ARABIC_NAME =
  /(?:الأستاذة|الأستاذ|الدكتورة|الدكتور|المهندسة|المهندس|السيدة|السيد|الشيخة|الشيخ|أ\.د\.|د\.|أ\.|م\.)\s*[ء-ي]+(?:\s+[ء-ي]+){0,2}/g;
const ENGLISH_NAME = /(?:Dr|Prof|Mr|Mrs|Ms|Eng)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceCount(text: string, re: RegExp, token: string): { text: string; count: number } {
  let count = 0;
  const out = text.replace(re, () => {
    count += 1;
    return token;
  });
  return { text: out, count };
}

// Redact PII from `text`. `knownNames` (e.g. the actor name, names parsed from a doc)
// are redacted wherever they appear, even without an honorific.
export function redact(text: string, knownNames: string[] = []): RedactionResult {
  const counts: Record<RedactionEntity, number> = {
    name: 0,
    national_id: 0,
    email: 0,
    phone: 0,
  };
  let t = text;

  let r = replaceCount(t, EMAIL, REDACTION_TOKENS.email);
  t = r.text;
  counts.email += r.count;

  for (const re of [SAUDI_PHONE, INTL_PHONE]) {
    r = replaceCount(t, re, REDACTION_TOKENS.phone);
    t = r.text;
    counts.phone += r.count;
  }

  r = replaceCount(t, NATIONAL_ID, REDACTION_TOKENS.national_id);
  t = r.text;
  counts.national_id += r.count;

  for (const re of [ARABIC_NAME, ENGLISH_NAME]) {
    r = replaceCount(t, re, REDACTION_TOKENS.name);
    t = r.text;
    counts.name += r.count;
  }
  for (const name of knownNames) {
    if (!name.trim()) continue;
    r = replaceCount(t, new RegExp(escapeRegExp(name.trim()), "g"), REDACTION_TOKENS.name);
    t = r.text;
    counts.name += r.count;
  }

  const total = counts.name + counts.national_id + counts.email + counts.phone;
  return { text: t, counts, total };
}

// True only if no raw structured PII remains. Used as a guard before any model call.
export function isRedacted(text: string): boolean {
  return ![EMAIL, SAUDI_PHONE, INTL_PHONE, NATIONAL_ID].some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
