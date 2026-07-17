// Program service (EP-03). Orchestrates the domain stage machine + business rules
// over the data layer. This is where BR-001/BR-002 are ENFORCED at the service layer:
// a program cannot reach the structure-gated stages (compliance/export) while its
// course count or total credit hours violate the rules (rule 10 / BR-019).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import {
  createProgram as repoCreate,
  getActiveProgram,
  updateProgramStage,
  insertStatusHistory,
  updateProgramMetrics,
  getProgramCourseStats,
  listPrograms,
  type Program,
  type NewProgram,
  type ProgramFilters,
} from "@/data/programsRepo";
import {
  STAGES,
  isStage,
  nextStage,
  isStructureGated,
  completionPctForStage,
  DEFAULT_SUB_STATUS,
  type Stage,
} from "@/domain/stages";
import { checkProgramStructure, type RuleIssue } from "@/domain/businessRules";

// Error carrying blocking rule issues so the API/UI can show Arabic messages.
export class ProgramRuleError extends Error {
  constructor(public readonly issues: RuleIssue[]) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "ProgramRuleError";
  }
}

// SC-02 — create from name + sector + field ONLY. No cloning of a prior program
// (rule 00: copying/cloning on creation is out of scope) — the input type has no
// source-program field, so cloning is impossible by construction.
export async function createProgram(input: NewProgram, actor: string): Promise<Program> {
  if (!input.name?.trim()) throw new Error("اسم البرنامج مطلوب.");
  if (!input.sectorId) throw new Error("القطاع مطلوب.");
  if (!input.fieldId) throw new Error("المجال مطلوب.");
  return repoCreate(input, actor);
}

export interface ProgramMetrics {
  completionPct: number;
  blockingErrors: number;
  warningsCount: number;
  issues: RuleIssue[];
}

// Recompute and persist the dashboard metrics. completion_pct is stage-driven;
// blocking_errors / warnings_count come from the structural BR checks currently true.
// (More contributors are added by later epics — compliance EP-16, quality EP-17.)
export async function recomputeMetrics(programId: string): Promise<ProgramMetrics> {
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("recomputeMetrics: program not found");

  const stats = await getProgramCourseStats(programId);
  const issues = checkProgramStructure(stats);
  const metrics: ProgramMetrics = {
    completionPct: completionPctForStage(program.current_stage as Stage),
    blockingErrors: issues.filter((i) => i.severity === "blocking").length,
    warningsCount: issues.filter((i) => i.severity === "warning").length,
    issues,
  };
  await updateProgramMetrics(programId, metrics);
  return metrics;
}

// Set a program to a specific stage, enforcing the structure gate, recording history
// and refreshing metrics. Used by advanceStage; also callable to jump stages.
export async function setStage(programId: string, target: string, actor: string): Promise<Program> {
  if (!isStage(target)) throw new Error(`مرحلة غير صالحة: ${target}`);
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");

  const program = await getActiveProgram(programId);
  if (!program) throw new Error("setStage: program not found");

  // Structure gate: block entry into compliance/export while BR-001/BR-002 are violated.
  if (isStructureGated(target as Stage)) {
    const issues = checkProgramStructure(await getProgramCourseStats(programId));
    const blocking = issues.filter((i) => i.severity === "blocking");
    if (blocking.length > 0) throw new ProgramRuleError(blocking);
  }

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "program.set_stage",
        program_id: programId,
        old_value: { current_stage: program.current_stage },
        new_value: { current_stage: target },
      },
      async () => {
        await updateProgramStage(client, programId, target, DEFAULT_SUB_STATUS, actor);
        await insertStatusHistory(client, programId, target, DEFAULT_SUB_STATUS, actor);
      },
      sink,
    );
  });

  await recomputeMetrics(programId);
  const updated = await getActiveProgram(programId);
  if (!updated) throw new Error("setStage: program vanished");
  return updated;
}

// Advance one stage forward in the linear flow (SC-05). Errors at the final stage.
export async function advanceStage(programId: string, actor: string): Promise<Program> {
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("advanceStage: program not found");
  const next = nextStage(program.current_stage as Stage);
  if (!next) throw new Error("البرنامج في المرحلة الأخيرة بالفعل (export).");
  return setStage(programId, next, actor);
}

export { listPrograms, getActiveProgram, STAGES };
export type { Program, ProgramFilters };
