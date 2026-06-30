// Grounded context assembly (AI-001/AI-003). PURE. Orders metadata-tagged chunks by
// source trust (highest first) and packs them into a character budget, so the model
// always sees the most trusted grounding first.

import { byTrustDesc } from "@/domain/rag/sourceTrust";
import type { SourceChunk } from "@/domain/rag/chunking";

export interface AssembledContext {
  orderedChunks: SourceChunk[];
  contextText: string;
  droppedForBudget: number;
}

export function assembleContext(
  chunks: SourceChunk[],
  opts: { maxChars?: number; table?: Record<string, number> } = {},
): AssembledContext {
  const maxChars = opts.maxChars ?? 4000;
  const ordered = [...chunks].sort(byTrustDesc(opts.table));

  const included: SourceChunk[] = [];
  let used = 0;
  let dropped = 0;
  for (const chunk of ordered) {
    const cost = chunk.content.length + 1;
    if (used + cost > maxChars && included.length > 0) {
      dropped += 1;
      continue;
    }
    included.push(chunk);
    used += cost;
  }

  const contextText = included.map((c) => `[${c.sourceType}] ${c.content}`).join("\n");

  return { orderedChunks: included, contextText, droppedForBudget: dropped };
}
