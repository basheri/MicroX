// Labor-market analysis service (EP-08). Creates/generates an analysis with skills +
// cited sources and a feasibility rating (a weak rating REQUIRES a justification), and
// owns the approval step that is the HARD precondition for program generation
// (rule 20: a program cannot generate without an approved market analysis).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  insertMarketAnalysis,
  insertSkills,
  insertSources,
  insertFeasibilityAssessment,
  approveAnalysis,
  getLatestAnalysis,
  hasApprovedAnalysis,
  listSkills,
  listSources,
  type MarketSkillInput,
  type MarketSourceInput,
} from "@/data/marketRepo";
import { validateFeasibility } from "@/domain/feasibility";
import { generateStructured } from "@/services/ragService";
import { assembleProgramContext } from "@/services/ragService";
import type { LLMProvider } from "@/services/llm/types";

export class MarketAnalysisNotApprovedError extends Error {
  constructor() {
    super("لا يمكن توليد البرنامج قبل اعتماد تحليل سوق العمل (شرط مسبق إلزامي).");
    this.name = "MarketAnalysisNotApprovedError";
  }
}

export interface CreateMarketAnalysisInput {
  programId: string;
  summary: string | null;
  feasibilityRating: string;
  justification?: string | null;
  skills: MarketSkillInput[];
  sources: MarketSourceInput[];
}

export async function createMarketAnalysis(
  input: CreateMarketAnalysisInput,
  actor: string,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(input.programId);
  if (!program) throw new Error("createMarketAnalysis: program not found");

  // Weak feasibility rating must be justified (throws otherwise).
  const rating = validateFeasibility({
    rating: input.feasibilityRating,
    justification: input.justification,
  });

  return withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    let analysisId = "";
    await withAudit(
      {
        actor_name: actor,
        operation_type: "market_analysis.create",
        program_id: input.programId,
        new_value: { rating, skills: input.skills.length, sources: input.sources.length },
      },
      async () => {
        analysisId = await insertMarketAnalysis(client, {
          programId: input.programId,
          summary: input.summary,
          feasibilityRating: rating,
          actor,
        });
        await insertSkills(client, analysisId, input.skills);
        await insertSources(client, analysisId, input.sources);
        await insertFeasibilityAssessment(client, {
          programId: input.programId,
          rating,
          justification: input.justification ?? null,
          actor,
        });
      },
      sink,
    );
    return analysisId;
  });
}

// JSON schema constraining the AI-generated market analysis (AI-002).
const MARKET_SCHEMA = {
  type: "object",
  required: ["summary", "feasibilityRating", "skills"],
  properties: {
    summary: { type: "string" },
    feasibilityRating: { enum: ["high", "medium", "low", "insufficient_evidence"] },
    justification: { type: "string" },
    skills: {
      type: "array",
      items: {
        type: "object",
        required: ["skill"],
        properties: { skill: { type: "string" }, demandLevel: { type: "string" } },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          reliability: { type: "string" },
        },
      },
    },
  },
} as const;

interface GeneratedMarket {
  summary: string;
  feasibilityRating: string;
  justification?: string;
  skills: MarketSkillInput[];
  sources?: MarketSourceInput[];
}

// Generate the analysis from grounded program context via the LLM (schema-constrained,
// mock provider in tests), then persist it. Not auto-approved (AI-006 human gate).
export async function generateMarketAnalysis(
  programId: string,
  actor: string,
  providerOverride?: LLMProvider,
): Promise<string> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const context = await assembleProgramContext(programId);
  const { data } = await generateStructured<GeneratedMarket>(
    {
      messages: [
        { role: "system", content: "أنت محلل سوق عمل. أعد تحليلًا بصيغة JSON مطابقة للمخطط." },
        {
          role: "user",
          content: `بناءً على السياق التالي، حلّل سوق العمل:\n${context.contextText}`,
        },
      ],
      schema: MARKET_SCHEMA as unknown as Record<string, unknown>,
      programId,
    },
    providerOverride,
  );

  return createMarketAnalysis(
    {
      programId,
      summary: data.summary,
      feasibilityRating: data.feasibilityRating,
      justification: data.justification ?? null,
      skills: data.skills ?? [],
      sources: data.sources ?? [],
    },
    actor,
  );
}

// Human-in-the-loop approval (AI-006). Sets is_approved -> unblocks generation.
export async function approveMarketAnalysis(analysisId: string, actor: string): Promise<void> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      { actor_name: actor, operation_type: "market_analysis.approve", new_value: { analysisId } },
      async () => {
        const ok = await approveAnalysis(client, analysisId);
        if (!ok) throw new Error("approveMarketAnalysis: analysis not found");
      },
      sink,
    );
  });
}

// THE precondition guard for EP-09 generation. Throws unless an approved analysis exists.
export async function requireApprovedMarketAnalysis(programId: string): Promise<void> {
  if (!(await hasApprovedAnalysis(programId))) {
    throw new MarketAnalysisNotApprovedError();
  }
}

export async function getMarketAnalysis(programId: string) {
  const analysis = await getLatestAnalysis(programId);
  if (!analysis) return null;
  const [skills, sources] = await Promise.all([listSkills(analysis.id), listSources(analysis.id)]);
  return { analysis, skills, sources };
}

export { hasApprovedAnalysis };
