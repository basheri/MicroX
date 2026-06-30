// Labor-market analysis data layer (EP-08). market_analysis + market_skills +
// market_sources + feasibility_assessments. All writes parameterized (SEC-003).

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export interface MarketSkillInput {
  skill: string;
  demandLevel?: string | null;
}
export interface MarketSourceInput {
  url?: string | null;
  title?: string | null;
  reliability?: string | null;
}

export async function insertMarketAnalysis(
  client: PoolClient,
  input: { programId: string; summary: string | null; feasibilityRating: string; actor: string },
): Promise<string> {
  const rows = await client.query<{ id: string }>(
    `insert into market_analysis (program_id, summary, feasibility_rating, is_approved, created_by_actor)
     values ($1, $2, $3, false, $4) returning id`,
    [input.programId, input.summary, input.feasibilityRating, input.actor],
  );
  return rows.rows[0]!.id;
}

export async function insertSkills(
  client: PoolClient,
  analysisId: string,
  skills: MarketSkillInput[],
): Promise<void> {
  for (const s of skills) {
    await client.query(
      "insert into market_skills (market_analysis_id, skill, demand_level) values ($1, $2, $3)",
      [analysisId, s.skill, s.demandLevel ?? null],
    );
  }
}

export async function insertSources(
  client: PoolClient,
  analysisId: string,
  sources: MarketSourceInput[],
): Promise<void> {
  for (const s of sources) {
    await client.query(
      "insert into market_sources (market_analysis_id, url, title, reliability) values ($1, $2, $3, $4)",
      [analysisId, s.url ?? null, s.title ?? null, s.reliability ?? null],
    );
  }
}

export async function insertFeasibilityAssessment(
  client: PoolClient,
  input: { programId: string; rating: string; justification: string | null; actor: string },
): Promise<void> {
  await client.query(
    `insert into feasibility_assessments (program_id, rating, justification, created_by_actor)
     values ($1, $2, $3, $4)`,
    [input.programId, input.rating, input.justification, input.actor],
  );
}

export async function approveAnalysis(client: PoolClient, analysisId: string): Promise<boolean> {
  const res = await client.query("update market_analysis set is_approved = true where id = $1", [
    analysisId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export interface MarketAnalysisRow {
  id: string;
  program_id: string;
  summary: string | null;
  feasibility_rating: string | null;
  is_approved: boolean;
  created_at: string;
}

export async function getLatestAnalysis(programId: string): Promise<MarketAnalysisRow | null> {
  const rows = await getPool().query<MarketAnalysisRow>(
    "select * from market_analysis where program_id = $1 order by created_at desc limit 1",
    [programId],
  );
  return rows.rows[0] ?? null;
}

// The precondition check for program generation (AI rule): is there an APPROVED analysis?
export async function hasApprovedAnalysis(programId: string): Promise<boolean> {
  const rows = await getPool().query<{ n: number }>(
    "select count(*)::int as n from market_analysis where program_id = $1 and is_approved = true",
    [programId],
  );
  return rows.rows[0]!.n > 0;
}

export async function listSkills(analysisId: string) {
  return (
    await getPool().query(
      "select skill, demand_level from market_skills where market_analysis_id = $1",
      [analysisId],
    )
  ).rows;
}

export async function listSources(analysisId: string) {
  return (
    await getPool().query(
      "select url, title, reliability from market_sources where market_analysis_id = $1",
      [analysisId],
    )
  ).rows;
}
