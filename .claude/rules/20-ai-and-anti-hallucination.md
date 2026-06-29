# 20 — AI & Anti-Hallucination (AI-001..008)

The promise to leadership is **"no unverified content reaches the official package"** — NOT "zero hallucination." Build to that promise.

## Pipeline
- **AI-001** Retrieval-augmented generation (RAG): chunk + metadata + source-priority ordering; assemble grounded context before generating.
- **AI-002** Every model output is constrained by a strict **JSON Schema**. Reject + retry on schema violation before persisting anything.
- **AI-003** Source priority: higher-trust sources (official guide/template) override lower-trust ones; surface conflicts to the user before approval.
- **AI-004** Anti-hallucination checks: citation verification, **external reference existence check**, cross-section consistency check.
- **AI-005** Confidence scoring at 5 levels (source / fact / field / section / document). **Block approval of low-confidence content** until reviewed/corrected.
- **AI-006** **Mandatory human-in-the-loop** gate before any final approval. No auto-approval path exists.
- **AI-007** OpenRouter behind `LLMProvider`; connection test required before use; log model + tokens + cost (no cap).
- **AI-008** Long generation runs as an async **Generation Job**: progress reports, cancel, regenerate, pin sections, preview-before-apply.

## Reference verification
- Generated references must be checked for existence and correct metadata. Unverified references are rejected and flagged — never silently included.

## Market analysis dependency
- Program generation requires an **approved** market analysis as a precondition (return a clear error if missing).
