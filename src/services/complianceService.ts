// Compliance engine + export gate service (EP-16 / D-08 / BR-019).
//
// - Rules are DATA-DRIVEN rows (seeded from @/config/complianceConfig, then editable
//   in the DB with no rebuild). `runComplianceChecks` reads the active rules at call
//   time, evaluates them against the program's facts, persists classified checks, and
//   updates the program's blocking/warning counters.
// - `attemptExport` is the BR-019 gate:
//     * a FAILED blocking check  -> export prevented (TC-11), no override.
//     * a FAILED low-quality (warning/suggestion) check -> export allowed ONLY with a
//       justification, which is saved to the audit log AND the export package (TC-12).

import { randomUUID } from "node:crypto";
import { withAudit } from "@/lib/audit";
import { withTransaction, getPool } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import { updateProgramMetrics } from "@/data/programsRepo";
import {
  upsertRule,
  listActiveRules,
  getProgramFacts,
  replaceChecks,
  listChecks,
  ruleIdMap,
  insertExportPackage,
  type CheckRow,
} from "@/data/complianceRepo";
import {
  evaluateRules,
  classifyFailures,
  exportDecision,
  type CheckResult,
  type Classified,
  type ExportDecision,
} from "@/domain/complianceEngine";
import { activeComplianceConfig, type ComplianceConfig } from "@/config/complianceConfig";

// Seed/refresh the rule set from config. Idempotent (upsert by rule_code): safe to
// run repeatedly; editing a seed updates its row. Runtime-added DB rules are untouched.
export async function seedComplianceRules(
  actor: string,
  config: ComplianceConfig = activeComplianceConfig(),
): Promise<number> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "compliance.rules.seed",
        new_value: { count: config.rules.length, isPlaceholder: config.isPlaceholder },
      },
      async () => {
        for (const r of config.rules) {
          await upsertRule(client, {
            ruleCode: r.ruleCode,
            description: r.description,
            severity: r.severity,
            ruleType: r.ruleType,
            factKey: r.factKey,
            params: r.params,
            message: r.message,
            category: r.category,
            isActive: r.isActive,
            isPlaceholder: r.isPlaceholder,
          });
        }
      },
      sink,
    );
    return config.rules.length;
  });
}

export interface ComplianceRun {
  runId: string;
  results: CheckResult[];
  classified: Classified;
  decision: ExportDecision;
}

// Evaluate the ACTIVE DB rules against the program's facts and persist the checks.
export async function runComplianceChecks(
  programId: string,
  actor: string,
): Promise<ComplianceRun> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("runComplianceChecks: program not found");

  const [rules, facts, idMap] = await Promise.all([
    listActiveRules(),
    getProgramFacts(programId),
    ruleIdMap(),
  ]);
  const results = evaluateRules(rules, facts);
  const classified = classifyFailures(results);
  const decision = exportDecision(results);
  const runId = randomUUID();

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "compliance.run",
        program_id: programId,
        new_value: {
          runId,
          blocking: classified.blocking.length,
          warning: classified.warning.length,
          suggestion: classified.suggestion.length,
          decision,
        },
      },
      async () => {
        await replaceChecks(client, programId, runId, results, idMap);
      },
      sink,
    );
  });

  // Keep the dashboard counters in sync (blocking + low-quality warnings).
  await updateProgramMetrics(programId, {
    completionPct: program.completion_pct ?? 0,
    blockingErrors: classified.blocking.length,
    warningsCount: classified.warning.length + classified.suggestion.length,
  });

  return { runId, results, classified, decision };
}

// Thrown when a blocking failure prevents export (BR-019 / TC-11). No override path.
export class ExportBlockedError extends Error {
  constructor(public readonly failures: CheckResult[]) {
    super("التصدير محظور بسبب أخطاء إلزامية (BR-019): " + failures.map((f) => f.message).join(" "));
    this.name = "ExportBlockedError";
  }
}

// Thrown when export is attempted past a low-quality failure WITHOUT a justification
// (BR-019 / TC-12). Providing a justification lets it through and saves it.
export class JustificationRequiredError extends Error {
  constructor(public readonly failures: CheckResult[]) {
    super(
      "التصدير بجودة منخفضة يتطلب تبريرًا يُحفظ في سجل التدقيق (BR-019): " +
        failures.map((f) => f.message).join(" "),
    );
    this.name = "JustificationRequiredError";
  }
}

export interface ExportOutcome {
  packageId: string;
  decision: ExportDecision;
  justification: string | null;
}

// The BR-019 export gate. Runs a fresh compliance pass, then:
//   blocked            -> throw ExportBlockedError (TC-11), regardless of justification.
//   needs_justification-> throw JustificationRequiredError unless a justification is
//                         supplied; when supplied, export proceeds and the
//                         justification is saved to the audit log + export package (TC-12).
//   clear              -> export proceeds.
export async function attemptExport(
  programId: string,
  actor: string,
  opts: { justification?: string } = {},
): Promise<ExportOutcome> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const run = await runComplianceChecks(programId, actor);

  if (run.decision === "blocked") {
    throw new ExportBlockedError(run.classified.blocking);
  }

  const lowQuality = [...run.classified.warning, ...run.classified.suggestion];
  const justification = opts.justification?.trim() ? opts.justification.trim() : null;
  if (run.decision === "needs_justification" && !justification) {
    throw new JustificationRequiredError(lowQuality);
  }

  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let packageId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.export",
        program_id: programId,
        new_value: { decision: run.decision, lowQuality: lowQuality.map((f) => f.ruleCode) },
        // BR-019: the justification is saved to the audit log for low-quality exports.
        override_justification: justification,
      },
      async () => {
        packageId = await insertExportPackage(client, {
          programId,
          status: "ready",
          justification,
          actor,
        });
      },
      sink,
    );
    return { packageId, decision: run.decision, justification };
  });
}

// Read-side helpers.
export function getComplianceChecks(programId: string): Promise<CheckRow[]> {
  return listChecks(programId);
}

// Whether the current rule set still carries placeholder (V-05) rules — surfaced so
// the mandatory-field list is not mistaken for the final official one.
export async function hasPlaceholderRules(): Promise<boolean> {
  const row = (
    await getPool().query<{ n: number }>(
      "select count(*)::int as n from compliance_rules where is_placeholder = true and is_active = true",
    )
  ).rows[0]!;
  return row.n > 0;
}
