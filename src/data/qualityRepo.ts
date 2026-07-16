// Quality data layer (EP-17). Gathers the numeric FACTS the deterministic detectors
// read (grounded in the alignment chain), and persists each assessment pass to
// quality_assessments. Reuses the EP-10 gap detectors for the "uncovered" counts.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";
import { uncoveredPLOs, uncoveredCLOs, contentWithoutOutcome } from "@/data/academicRepo";
import type { QualityFacts, AxisScore } from "@/domain/qualityEngine";

async function count(sql: string, params: unknown[]): Promise<number> {
  const rows = await getPool().query<{ n: number }>(sql, params);
  return rows.rows[0]?.n ?? 0;
}

export async function getQualityFacts(programId: string): Promise<QualityFacts> {
  const [
    ploTotal,
    cloTotal,
    unitsTotal,
    questionsTotal,
    questionsUnlinked,
    verifiedReferences,
    ploGaps,
    cloGaps,
    unitGaps,
  ] = await Promise.all([
    count(
      "select count(*)::int n from program_learning_outcomes where program_id = $1 and is_deleted = false",
      [programId],
    ),
    count(
      `select count(*)::int n from course_learning_outcomes c
         join courses co on co.id = c.course_id
        where co.program_id = $1 and c.is_deleted = false`,
      [programId],
    ),
    count(
      `select count(*)::int n from course_units u
         join courses co on co.id = u.course_id
        where co.program_id = $1 and u.is_deleted = false`,
      [programId],
    ),
    count(
      `select count(*)::int n from questions q
         join question_banks b on b.id = q.question_bank_id
        where b.program_id = $1 and b.is_deleted = false`,
      [programId],
    ),
    count(
      `select count(*)::int n from questions q
         join question_banks b on b.id = q.question_bank_id
        where b.program_id = $1 and b.is_deleted = false and q.clo_id is null`,
      [programId],
    ),
    count(
      "select count(*)::int n from program_references where program_id = $1 and is_deleted = false and verified = true",
      [programId],
    ),
    uncoveredPLOs(programId),
    uncoveredCLOs(programId),
    contentWithoutOutcome(programId),
  ]);

  return {
    ploTotal,
    ploUncovered: ploGaps.length,
    cloTotal,
    cloUncovered: cloGaps.length,
    unitsTotal,
    unitsUnaligned: unitGaps.length,
    questionsTotal,
    questionsUnlinked,
    verifiedReferences,
  };
}

// A small sample of outcome statements for the LLM-assisted clarity axis (grounding).
export async function sampleOutcomeStatements(programId: string, limit = 5): Promise<string[]> {
  const rows = await getPool().query<{ statement: string }>(
    `select statement from program_learning_outcomes
       where program_id = $1 and is_deleted = false order by created_at limit $2`,
    [programId, limit],
  );
  return rows.rows.map((r) => r.statement);
}

// Persist one assessment pass: the per-axis rows plus an 'overall' row.
export async function persistAssessment(
  client: PoolClient,
  input: { programId: string; runId: string; axes: AxisScore[]; overall: number; actor: string },
): Promise<void> {
  for (const a of input.axes) {
    await client.query(
      `insert into quality_assessments
         (program_id, axis, axis_label, kind, weight, score, confidence, is_warning,
          evidence, notes, run_id, created_by_actor)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        input.programId,
        a.key,
        a.label,
        a.kind,
        a.weight,
        a.score,
        a.confidence,
        a.isWarning,
        JSON.stringify(a.evidence),
        a.evidence.join(" ") || null,
        input.runId,
        input.actor,
      ],
    );
  }
  await client.query(
    `insert into quality_assessments
       (program_id, axis, axis_label, kind, weight, score, is_warning, run_id, created_by_actor)
     values ($1,'overall','النتيجة الإجمالية','overall',1,$2,false,$3,$4)`,
    [input.programId, input.overall, input.runId, input.actor],
  );
}

export interface QualityRow {
  axis: string;
  axis_label: string | null;
  kind: string;
  score: number;
  weight: number;
  confidence: string | null;
  is_warning: boolean;
  evidence: string[];
  run_id: string;
}

// The most recent assessment pass (all axes + overall), newest run.
export async function getLatestAssessment(programId: string): Promise<QualityRow[]> {
  const rows = await getPool().query<QualityRow>(
    `select axis, axis_label, kind, score::float as score, weight::float as weight,
            confidence, is_warning, evidence, run_id
       from quality_assessments
      where program_id = $1
        and run_id = (
          select run_id from quality_assessments
           where program_id = $1 order by created_at desc limit 1
        )
      order by kind = 'overall', axis`,
    [programId],
  );
  return rows.rows;
}
