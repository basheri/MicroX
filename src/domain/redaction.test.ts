import { describe, it, expect } from "vitest";
import { redact, isRedacted } from "@/domain/redaction";

// SEC-006 — the redaction pipeline must remove names / national IDs / emails / phones
// from any text BEFORE it is bound for the model.
describe("redaction pipeline (SEC-006)", () => {
  const text = [
    "للتواصل مع الدكتور محمد بشيري على البريد m.basheri@kau.edu.sa أو الهاتف 0501234567.",
    "المنسق Prof. John Smith، الهوية الوطنية 1012345678، ورقم دولي +14155552671.",
    "كما شارك أحمد العتيبي في الإعداد.",
  ].join("\n");

  it("removes every category of PII", () => {
    const r = redact(text, ["أحمد العتيبي"]);

    // Emails / phones / national IDs gone.
    expect(r.text).not.toContain("m.basheri@kau.edu.sa");
    expect(r.text).not.toContain("0501234567");
    expect(r.text).not.toContain("+14155552671");
    expect(r.text).not.toContain("1012345678");
    // Names gone (Arabic honorific, English title, and an explicit known name).
    expect(r.text).not.toContain("بشيري");
    expect(r.text).not.toContain("John");
    expect(r.text).not.toContain("Smith");
    expect(r.text).not.toContain("العتيبي");

    // Nothing structured remains.
    expect(isRedacted(r.text)).toBe(true);
  });

  it("counts each category for redaction_logs", () => {
    const r = redact(text, ["أحمد العتيبي"]);
    expect(r.counts.email).toBe(1);
    expect(r.counts.phone).toBe(2);
    expect(r.counts.national_id).toBe(1);
    expect(r.counts.name).toBeGreaterThanOrEqual(3);
    expect(r.total).toBe(r.counts.email + r.counts.phone + r.counts.national_id + r.counts.name);
  });

  it("is a no-op on clean text", () => {
    const clean = "هذا نص لا يحتوي على بيانات شخصية.";
    const r = redact(clean);
    expect(r.text).toBe(clean);
    expect(r.total).toBe(0);
    expect(isRedacted(clean)).toBe(true);
  });

  it("detects residual PII via isRedacted", () => {
    expect(isRedacted("راسلني على a@b.com")).toBe(false);
    expect(isRedacted("رقمي 0512345678")).toBe(false);
  });
});
