// RAG & knowledge engine service (EP-07). Assembles grounded context from ONLY
// gate-cleared extraction (TC-09), ordered by source trust (AI-003), and runs
// JSON-Schema-constrained generation with retry + token logging (AI-002 / AI-007).

import { listProgramFiles } from "@/data/sourcesRepo";
import { getUsableExtraction } from "@/data/extractionRepo";
import { insertLlmRequest } from "@/data/llmSettingsRepo";
import { getConfiguredProvider } from "@/services/llmSettingsService";
import {
  completeJson,
  SchemaValidationError,
  type StructuredResult,
} from "@/services/llm/structured";
import { chunksFromSource, type SourceChunk } from "@/domain/rag/chunking";
import { assembleContext, type AssembledContext } from "@/domain/rag/contextAssembly";
import type { ChatMessage, LLMProvider } from "@/services/llm/types";

export { resolveClaims } from "@/domain/rag/conflict";
export type { Claim, Conflict, ResolutionResult } from "@/domain/rag/conflict";

// Build grounded context for a program from its gate-cleared extracted content.
// NOTE: the schema does not link uploaded_files -> program_sources.source_type, so the
// per-file trust class is supplied by the caller (sourceTypeByFile); unspecified files
// default to 'from_university'. This mapping is data-driven, not an academic rule.
export async function assembleProgramContext(
  programId: string,
  opts: { maxChars?: number; sourceTypeByFile?: Record<string, string> } = {},
): Promise<AssembledContext> {
  const files = await listProgramFiles(programId);
  const chunks: SourceChunk[] = [];
  let order = 0;
  for (const f of files) {
    const usable = await getUsableExtraction(f.file_id); // excludes low-confidence/unreviewed
    const text = usable.map((u) => u.content).join("\n");
    if (!text.trim()) continue;
    const sourceType = opts.sourceTypeByFile?.[f.file_id] ?? "from_university";
    const built = chunksFromSource({ text, sourceType, sourceId: f.file_id, startOrder: order });
    chunks.push(...built);
    order += built.length;
  }
  return assembleContext(chunks, { maxChars: opts.maxChars });
}

// Schema-constrained generation: validates + retries, logs tokens/cost (no cap), and
// only ever returns schema-valid data (AI-002). Provider is injectable for tests.
export async function generateStructured<T = unknown>(
  params: {
    messages: ChatMessage[];
    schema: Record<string, unknown>;
    maxRetries?: number;
    programId?: string | null;
  },
  providerOverride?: LLMProvider,
): Promise<StructuredResult<T>> {
  const provider = providerOverride ?? (await getConfiguredProvider());
  try {
    const out = await completeJson<T>(provider, {
      messages: params.messages,
      schema: params.schema,
      maxRetries: params.maxRetries,
    });
    await insertLlmRequest({
      programId: params.programId ?? null,
      model: provider.modelId,
      tokensIn: out.usage.tokensIn,
      tokensOut: out.usage.tokensOut,
      cost: out.usage.costUsd,
      status: "success",
    });
    return out;
  } catch (err) {
    await insertLlmRequest({
      programId: params.programId ?? null,
      model: provider.modelId,
      tokensIn: 0,
      tokensOut: 0,
      cost: null,
      status: err instanceof SchemaValidationError ? "schema_failed" : "error",
    });
    throw err;
  }
}
