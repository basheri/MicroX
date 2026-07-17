// Quality engine service (EP-17 / SC-19 / AI-005). Gathers facts, runs the six-axis
// engine, scores the LLM-assisted axis through the LLMProvider abstraction (mock by
// default — no live calls), persists the assessment, and audits it.
//
// Quality is ADVISORY: this service NEVER blocks export. The export gate is
// compliance-only (see complianceService.attemptExport / BR-019).

import { randomUUID } from "node:crypto";
import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { getActiveProgram } from "@/data/programsRepo";
import {
  getQualityFacts,
  sampleOutcomeStatements,
  persistAssessment,
  getLatestAssessment,
  type QualityRow,
} from "@/data/qualityRepo";
import { assessQuality, type LlmAxisResult, type QualityResult } from "@/domain/qualityEngine";
import { activeQualityConfig, type QualityConfig } from "@/config/qualityConfig";
import type { LLMProvider } from "@/services/llm/types";
import { MockLLMProvider } from "@/services/llm/mockProvider";
import { completeJson } from "@/services/llm/structured";

// Strict schema for the LLM-assisted clarity axis (AI-002 + AI-005 confidence).
const CLARITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "confidence", "rationale"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    rationale: { type: "string", minLength: 1 },
  },
} as const;

// Default mock provider returns a valid, schema-conforming JSON so the whole pipeline
// works locally with NO live OpenRouter call (deferred to EP-23).
function defaultProvider(): LLMProvider {
  return new MockLLMProvider(
    "mock/model",
    JSON.stringify({
      score: 80,
      confidence: "medium",
      rationale: "صياغة المخرجات واضحة بوجه عام (تقييم تجريبي عبر المزوّد الوهمي).",
    }),
  );
}

async function scoreClarityAxis(
  provider: LLMProvider,
  outcomes: string[],
): Promise<LlmAxisResult | null> {
  if (outcomes.length === 0) return null; // nothing to assess -> axis reported insufficient
  try {
    const { data } = await completeJson<LlmAxisResult>(provider, {
      messages: [
        {
          role: "system",
          content:
            "أنت مُقيّم لغوي أكاديمي. قيّم وضوح صياغة مخرجات التعلّم من 0 إلى 100 وأعد JSON فقط.",
        },
        { role: "user", content: `المخرجات:\n- ${outcomes.join("\n- ")}` },
      ],
      schema: CLARITY_SCHEMA as unknown as Record<string, unknown>,
    });
    return { score: data.score, confidence: data.confidence, rationale: data.rationale };
  } catch {
    // A model/schema failure must not break quality assessment — report as not assessed.
    return null;
  }
}

export interface AssessResult extends QualityResult {
  runId: string;
}

export async function assessProgramQuality(
  programId: string,
  actor: string,
  deps: { provider?: LLMProvider; config?: QualityConfig } = {},
): Promise<AssessResult> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  const program = await getActiveProgram(programId);
  if (!program) throw new Error("assessProgramQuality: program not found");

  const config = deps.config ?? activeQualityConfig();
  const provider = deps.provider ?? defaultProvider();

  const [facts, outcomes] = await Promise.all([
    getQualityFacts(programId),
    sampleOutcomeStatements(programId),
  ]);
  const llm = await scoreClarityAxis(provider, outcomes);
  const result = assessQuality(config, facts, llm);
  const runId = randomUUID();

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "quality.assess",
        program_id: programId,
        // llm_model logged for transparency (AI-007); model swaps never touch this logic.
        llm_model: llm ? provider.modelId : null,
        new_value: {
          runId,
          overall: result.overall,
          warnings: result.warnings.map((w) => w.key),
          blocksExport: result.blocksExport, // always false — quality never blocks
        },
      },
      async () => {
        await persistAssessment(client, {
          programId,
          runId,
          axes: result.axes,
          overall: result.overall,
          actor,
        });
      },
      sink,
    );
  });

  return { ...result, runId };
}

export function getProgramQuality(programId: string): Promise<QualityRow[]> {
  return getLatestAssessment(programId);
}
