// @vitest-environment node
//
// EP-14 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// a fabricated/unverifiable reference is REJECTED + FLAGGED (never silently included);
// verified references are listed; AR/EN lists. Verifier is injected (no live network).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import {
  addReference,
  verifyReference,
  getVerifiedReferences,
  getFlaggedReferences,
  listReferencesByLanguage,
} from "@/services/referenceService";
import type { ReferenceVerifier } from "@/services/references/verifier";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

// Fake verifier: a set of "real" citations exist; everything else does not.
const fakeVerifier = (real: Set<string>): ReferenceVerifier => ({
  verify: async (citation) =>
    real.has(citation)
      ? { exists: true, note: "تم التحقق (اختبار)." }
      : { exists: false, note: "المرجع غير موجود (مُختلَق)." },
});

suite("EP-14 — references & verification (integration)", () => {
  let db: IsolatedDb;
  let programId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep14");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    programId = (await createProgram({ name: "برنامج المراجع", sectorId, fieldId }, "منى")).id;
  });
  afterAll(async () => {
    await db?.teardown();
  });

  // TC-10 — the required proof.
  it("TC-10: a fabricated reference is rejected + flagged, not silently included", async () => {
    const REAL = "Real, A. (2021). Study. doi:10.1000/real.1";
    const FAKE = "Fabricated, X. (2099). Nonexistent study. مرجع مُختلَق";
    const verifier = fakeVerifier(new Set([REAL]));

    const realId = await addReference(programId, { citation: REAL, language: "en" }, "منى");
    const fakeId = await addReference(programId, { citation: FAKE, language: "ar" }, "منى");

    const realRow = await verifyReference(realId, "منى", verifier);
    const fakeRow = await verifyReference(fakeId, "منى", verifier);

    expect(realRow.verified).toBe(true);
    expect(fakeRow.verified).toBe(false); // rejected
    expect(fakeRow.verification_note).toMatch(/مُختلَق|غير موجود/); // flagged with a reason

    // The fabricated reference is NOT in the verified list...
    const verified = await getVerifiedReferences(programId);
    expect(verified.map((r) => r.id)).toContain(realId);
    expect(verified.map((r) => r.id)).not.toContain(fakeId);

    // ...but it IS surfaced in the flagged list (not silently dropped).
    const flagged = await getFlaggedReferences(programId);
    expect(flagged.map((r) => r.id)).toContain(fakeId);

    // The verification decision is audited.
    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='reference.verify'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it("provides Arabic and English lists", async () => {
    const ar = await listReferencesByLanguage(programId, "ar");
    const en = await listReferencesByLanguage(programId, "en");
    expect(ar.every((r) => r.language === "ar")).toBe(true);
    expect(en.every((r) => r.language === "en")).toBe(true);
    expect(ar.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });

  it("refuses anonymous reference operations (rule 00)", async () => {
    await expect(addReference(programId, { citation: "x", language: "ar" }, "")).rejects.toThrow(
      /actor_name is required/,
    );
  });
});
