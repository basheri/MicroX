// Program stage machine (EP-03 / SC-05). The 14 stages are authoritative — they
// mirror the programs.current_stage CHECK in the schema, in order. PURE + testable.

export const STAGES = [
  "new",
  "sources",
  "market",
  "feasibility",
  "structure",
  "outcomes",
  "courses",
  "content",
  "hours",
  "questions",
  "references",
  "review",
  "compliance",
  "export",
] as const;

export type Stage = (typeof STAGES)[number];

// Stages at/after which the structural export-gate rules (BR-001/BR-002) must hold.
// Reaching compliance/export with a broken structure is blocked (rule 10 / BR-019).
export const STRUCTURE_GATED_STAGES: readonly Stage[] = ["compliance", "export"];

// SPEC GAP: SC-05 references "10 sub-statuses" by COUNT but the kit never names them.
// We model sub_status as a free-form, data-driven field rather than invent an official
// set. `not_started` is the neutral default on entering a stage. Replace this list with
// the official names when provided (no code change needed — it is data-driven).
export const DEFAULT_SUB_STATUS = "not_started";

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

// The next stage in the linear flow, or null if already at the final stage.
export function nextStage(stage: Stage): Stage | null {
  const i = stageIndex(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1]! : null;
}

export function isStructureGated(stage: Stage): boolean {
  return STRUCTURE_GATED_STAGES.includes(stage);
}

// Stage-driven completion percentage (0 at 'new', 100 at 'export'). Western numerals.
export function completionPctForStage(stage: Stage): number {
  return Math.round((stageIndex(stage) / (STAGES.length - 1)) * 100);
}
