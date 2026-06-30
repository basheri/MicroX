// Text chunking with metadata (AI-001). PURE. Splits long text into overlapping
// windows on whitespace boundaries so chunks stay within a size budget for retrieval.

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 800;
  const overlap = Math.min(opts.overlap ?? 100, Math.floor(maxChars / 2));
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    // Prefer to break on a space within the window (avoid cutting a word).
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export interface SourceChunk {
  content: string;
  sourceType: string;
  sourceId: string;
  order: number;
}

// Build metadata-tagged chunks from a source's text.
export function chunksFromSource(
  input: { text: string; sourceType: string; sourceId: string; startOrder?: number },
  opts?: ChunkOptions,
): SourceChunk[] {
  return chunkText(input.text, opts).map((content, i) => ({
    content,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    order: (input.startOrder ?? 0) + i,
  }));
}
