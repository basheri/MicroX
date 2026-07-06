// @vitest-environment node
//
// EP-16 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the
// data-driven compliance engine + export gate (BR-019):
//   (a) TC-11 — a blocking failure prevents export (no override).
//   (b) TC-12 — low quality does NOT block but requires a justification that is
//               SAVED to the audit log (and export package).
//   (c) rules are editable in the DB with NO code change (add/remove a rule row and
//       the gate's behaviour changes on the next run).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { addCourse } from "@/services/academicService";
import {
  seedComplianceRules,
  runComplianceChecks,
  attemptExport,
  getComplianceChecks,
  hasPlaceholderRules,
  ExportBlockedError,
  JustificationRequiredError,
} from "@/services/complianceService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-16 — compliance engine & export gate (integration)", () => {
  let db: IsolatedDb;
  let validProgram: string; // 2 courses, name present, 0 verified refs -> low quality only
  let invalidProgram: string; // 1 course -> BR-001 blocking

  beforeAll(async () => {
    db = await createIsolatedDb("ep16");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);

    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;

    await seedComplianceRules("منى");

    validProgram = (await createProgram({ name: "برنامج مطابق", sectorId, fieldId }, "منى")).id;
    await addCourse(validProgram, { title: "مقرر ١", creditHours: 3 }, "منى");
    await addCourse(validProgram, { title: "مقرر ٢", creditHours: 3 }, "منى");

    invalidProgram = (await createProgram({ name: "برنامج ناقص", sectorId, fieldId }, "منى")).id;
    await addCourse(invalidProgram, { title: "مقرر وحيد", creditHours: 3 }, "منى");
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("seeds editable rules and flags the placeholder (V-05) set", async () => {
    const rows = await getPool().query("select count(*)::int n from compliance_rules");
    expect(rows.rows[0].n).toBeGreaterThanOrEqual(4);
    // V-05 not finalized: at least one active placeholder rule is present and flagged.
    expect(await hasPlaceholderRules()).toBe(true);
  });

  it("evaluates a valid program to low-quality-only and persists classified checks", async () => {
    const run = await runComplianceChecks(validProgram, "منى");
    expect(run.classified.blocking).toHaveLength(0);
    expect(run.decision).toBe("needs_justification"); // 0 verified refs -> warning
    expect(run.classified.warning.map((f) => f.ruleCode)).toContain("COMP-QUALITY-REFERENCES");

    // Checks are persisted (both pass and fail rows), grouped by run.
    const checks = await getComplianceChecks(validProgram);
    expect(checks.length).toBeGreaterThanOrEqual(4);
    expect(checks.some((c) => c.status === "pass")).toBe(true);
    expect(checks.some((c) => c.status === "fail")).toBe(true);

    // Program counters updated (blocking 0, one warning).
    const p = await getPool().query(
      "select blocking_errors, warnings_count from programs where id = $1",
      [validProgram],
    );
    expect(p.rows[0].blocking_errors).toBe(0);
    expect(p.rows[0].warnings_count).toBeGreaterThanOrEqual(1);
  });

  it("TC-11: a blocking error PREVENTS export — even with a justification", async () => {
    await expect(
      attemptExport(invalidProgram, "منى", { justification: "أرجو التجاوز" }),
    ).rejects.toBeInstanceOf(ExportBlockedError);

    // No successful export package was written for the blocked program.
    const pkgs = await getPool().query(
      "select count(*)::int n from export_packages where program_id = $1 and status = 'ready'",
      [invalidProgram],
    );
    expect(pkgs.rows[0].n).toBe(0);

    // The blocking check was recorded (BR-001).
    const checks = await getComplianceChecks(invalidProgram);
    expect(checks.some((c) => c.rule_code === "COMP-BR-001" && c.status === "fail")).toBe(true);
  });

  it("TC-12: low quality does NOT block but REQUIRES a justification", async () => {
    // Without a justification -> blocked with the specific error.
    await expect(attemptExport(validProgram, "منى")).rejects.toBeInstanceOf(
      JustificationRequiredError,
    );
    await expect(
      attemptExport(validProgram, "منى", { justification: "   " }),
    ).rejects.toBeInstanceOf(JustificationRequiredError);

    // With a justification -> export proceeds and the justification is SAVED.
    const out = await attemptExport(validProgram, "منى", {
      justification: "المراجع قيد التوثيق؛ اعتمد المحتوى يدويًا.",
    });
    expect(out.decision).toBe("needs_justification");
    expect(out.justification).toContain("قيد التوثيق");

    // Saved to the export package.
    const pkg = await getPool().query(
      "select status, justification from export_packages where id = $1",
      [out.packageId],
    );
    expect(pkg.rows[0].status).toBe("ready");
    expect(pkg.rows[0].justification).toContain("قيد التوثيق");

    // Saved to the AUDIT LOG (BR-019: override_justification on the export entry).
    const audit = await getPool().query(
      `select override_justification from audit_logs
         where program_id = $1 and operation_type = 'program.export'
         order by occurred_at desc limit 1`,
      [validProgram],
    );
    expect(audit.rows[0].override_justification).toContain("قيد التوثيق");
  });

  it("(c) rules are EDITABLE in the DB with no code change — add then remove a rule", async () => {
    // A valid program currently exports (with justification). Add a stricter blocking
    // rule directly in the DB — no code change — and the SAME program is now blocked.
    await getPool().query(
      `insert into compliance_rules
         (rule_code, description, severity, rule_type, fact_key, params, message,
          category, is_active, is_placeholder)
       values ('COMP-TEST-MAXCOURSES','حد أقصى للاختبار','blocking','numeric_max',
               'courses_count', '{"max":1}'::jsonb, 'المقررات تتجاوز الحد الأقصى للاختبار.',
               'structure', true, false)`,
    );

    await expect(
      attemptExport(validProgram, "منى", { justification: "تبرير" }),
    ).rejects.toBeInstanceOf(ExportBlockedError);

    const withRule = await runComplianceChecks(validProgram, "منى");
    expect(withRule.classified.blocking.map((f) => f.ruleCode)).toContain("COMP-TEST-MAXCOURSES");

    // Remove the rule (still no code change) — behaviour reverts on the next run.
    await getPool().query("delete from compliance_rules where rule_code = 'COMP-TEST-MAXCOURSES'");
    const without = await runComplianceChecks(validProgram, "منى");
    expect(without.classified.blocking).toHaveLength(0);
    expect(without.decision).toBe("needs_justification");
  });

  it("a fully-compliant program exports with a CLEAR decision (no justification)", async () => {
    // Add a verified reference so the quality rule passes -> decision becomes clear.
    await getPool().query(
      `insert into program_references (program_id, citation, language, verified)
       values ($1, 'مرجع موثّق', 'ar', true)`,
      [validProgram],
    );
    const run = await runComplianceChecks(validProgram, "منى");
    expect(run.decision).toBe("clear");

    const out = await attemptExport(validProgram, "منى"); // no justification needed
    expect(out.decision).toBe("clear");
    expect(out.justification).toBeNull();
  });

  it("refuses anonymous compliance/export operations (rule 00)", async () => {
    await expect(runComplianceChecks(validProgram, "")).rejects.toThrow(/actor_name is required/);
    await expect(attemptExport(validProgram, "")).rejects.toThrow(/actor_name is required/);
    await expect(seedComplianceRules("")).rejects.toThrow(/actor_name is required/);
  });
});
