// Compliance data layer (EP-16). Rules are editable ROWS (D-08); checks record each
// evaluation. Facts are read straight from the domain tables so a rule can reference
// them by `fact_key` without the engine knowing their provenance.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import type { EvalRule, ProgramFacts, CheckResult } from "@/domain/complianceEngine";
import type { RuleType } from "@/domain/complianceEngine";
import type { Severity } from "@/domain/businessRules";

export interface RuleRow {
  id: string;
  rule_code: string;
  severity: Severity;
  rule_type: RuleType;
  fact_key: string | null;
  params: { min?: number; max?: number };
  message: string | null;
  category: string | null;
  is_active: boolean;
  is_placeholder: boolean;
}

// Upsert a rule by its stable code — seeding is idempotent and re-runnable, and an
// edited seed updates the row in place (no duplicate codes; rule_code is unique).
export async function upsertRule(
  client: PoolClient,
  rule: {
    ruleCode: string;
    description: string;
    severity: Severity;
    ruleType: RuleType;
    factKey: string;
    params: { min?: number; max?: number };
    message: string;
    category: string;
    isActive: boolean;
    isPlaceholder: boolean;
  },
): Promise<void> {
  await client.query(
    `insert into compliance_rules
       (rule_code, description, severity, rule_type, fact_key, params, message, category,
        is_active, is_placeholder)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (rule_code) do update set
       description = excluded.description,
       severity = excluded.severity,
       rule_type = excluded.rule_type,
       fact_key = excluded.fact_key,
       params = excluded.params,
       message = excluded.message,
       category = excluded.category,
       is_active = excluded.is_active,
       is_placeholder = excluded.is_placeholder`,
    [
      rule.ruleCode,
      rule.description,
      rule.severity,
      rule.ruleType,
      rule.factKey,
      JSON.stringify(rule.params),
      rule.message,
      rule.category,
      rule.isActive,
      rule.isPlaceholder,
    ],
  );
}

// Active rules, as the engine's EvalRule shape. Reading is the ONLY place rules
// come from at evaluation time — editing the DB changes behaviour, no rebuild.
export async function listActiveRules(): Promise<EvalRule[]> {
  const rows = await getPool().query<RuleRow>(
    `select id, rule_code, severity, rule_type, fact_key, params, message, category,
            is_active, is_placeholder
       from compliance_rules where is_active = true order by rule_code`,
  );
  return rows.rows.map((r) => ({
    ruleCode: r.rule_code,
    severity: r.severity,
    ruleType: r.rule_type,
    factKey: r.fact_key ?? "",
    params: r.params ?? {},
    message: r.message ?? "",
  }));
}

export async function listRuleRows(): Promise<RuleRow[]> {
  const rows = await getPool().query<RuleRow>(
    `select id, rule_code, severity, rule_type, fact_key, params, message, category,
            is_active, is_placeholder
       from compliance_rules order by rule_code`,
  );
  return rows.rows;
}

// Program FACTS the rules read. Every value is numeric (presence as 1/0) so rules
// stay declarative. Adding a fact here + a rule row is enough to extend coverage.
export async function getProgramFacts(programId: string): Promise<ProgramFacts> {
  const courses = (
    await getPool().query<{ c: number; credits: number }>(
      `select count(*)::int as c, coalesce(sum(credit_hours), 0)::int as credits
         from courses where program_id = $1 and is_deleted = false`,
      [programId],
    )
  ).rows[0]!;
  const program = (
    await getPool().query<{ name: string | null }>(
      "select name from programs where id = $1 and is_deleted = false",
      [programId],
    )
  ).rows[0];
  const schedule = (
    await getPool().query<{ ta: number | null }>(
      "select total_actual::float as ta from program_schedules where program_id = $1 order by created_at desc limit 1",
      [programId],
    )
  ).rows[0];
  const refs = (
    await getPool().query<{ n: number }>(
      "select count(*)::int as n from program_references where program_id = $1 and is_deleted = false and verified = true",
      [programId],
    )
  ).rows[0]!;

  return {
    courses_count: courses.c,
    total_credit_hours: courses.credits,
    total_actual_hours: schedule?.ta != null ? Math.round(schedule.ta) : 0,
    program_name_present: program?.name && program.name.trim().length > 0 ? 1 : 0,
    verified_references_count: refs.n,
  };
}

// Persist one evaluation pass: clear the program's prior checks, then insert the new
// classified set. `run_id` groups the pass.
export async function replaceChecks(
  client: PoolClient,
  programId: string,
  runId: string,
  results: CheckResult[],
  ruleIdByCode: Map<string, string>,
): Promise<void> {
  await client.query("delete from compliance_checks where program_id = $1", [programId]);
  for (const r of results) {
    await client.query(
      `insert into compliance_checks
         (program_id, rule_id, rule_code, severity, status, message, observed_value, run_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        programId,
        ruleIdByCode.get(r.ruleCode) ?? null,
        r.ruleCode,
        r.severity,
        r.passed ? "pass" : "fail",
        r.message,
        r.observed === null ? null : String(r.observed),
        runId,
      ],
    );
  }
}

export interface CheckRow {
  rule_code: string;
  severity: Severity;
  status: "pass" | "fail";
  message: string | null;
  observed_value: string | null;
}

export async function listChecks(programId: string): Promise<CheckRow[]> {
  const rows = await getPool().query<CheckRow>(
    `select rule_code, severity, status, message, observed_value
       from compliance_checks where program_id = $1 order by severity, rule_code`,
    [programId],
  );
  return rows.rows;
}

export async function ruleIdMap(): Promise<Map<string, string>> {
  const rows = await getPool().query<{ id: string; rule_code: string }>(
    "select id, rule_code from compliance_rules",
  );
  return new Map(rows.rows.map((r) => [r.rule_code, r.id]));
}

// Export gate record (BR-019). `justification` is required when exporting past a
// low-quality (warning/suggestion) failure; it is also written to the audit log.
export async function insertExportPackage(
  client: PoolClient,
  input: {
    programId: string;
    status: "ready" | "failed";
    justification: string | null;
    actor: string;
  },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into export_packages (program_id, status, justification, created_by_actor)
     values ($1,$2,$3,$4) returning id`,
    [input.programId, input.status, input.justification, input.actor],
  );
  return rows.rows[0]!.id;
}

export async function getExportPackage(
  id: string,
): Promise<{ id: string; status: string; justification: string | null } | null> {
  const rows = await getPool().query<{ id: string; status: string; justification: string | null }>(
    "select id, status, justification from export_packages where id = $1",
    [id],
  );
  return rows.rows[0] ?? null;
}
