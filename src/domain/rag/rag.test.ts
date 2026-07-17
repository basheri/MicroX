import { describe, it, expect } from "vitest";
import { trustRank, byTrustDesc } from "@/domain/rag/sourceTrust";
import { chunkText, chunksFromSource } from "@/domain/rag/chunking";
import { assembleContext } from "@/domain/rag/contextAssembly";
import { resolveClaims, type Claim } from "@/domain/rag/conflict";

describe("source trust (AI-003)", () => {
  it("ranks official sources above lower-trust ones", () => {
    expect(trustRank("from_center")).toBeGreaterThan(trustRank("from_university"));
    expect(trustRank("from_university")).toBeGreaterThan(trustRank("professional_sector"));
    expect(trustRank("unknown_xyz")).toBe(0);
  });
});

describe("chunking (AI-001)", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("نص قصير")).toEqual(["نص قصير"]);
  });
  it("splits long text into overlapping windows within the budget", () => {
    const text = Array.from({ length: 50 }, (_, i) => `كلمة${i}`).join(" ");
    const chunks = chunkText(text, { maxChars: 60, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
  });
  it("tags chunks with source metadata", () => {
    const out = chunksFromSource({ text: "محتوى", sourceType: "from_center", sourceId: "f1" });
    expect(out[0]).toMatchObject({ sourceType: "from_center", sourceId: "f1", order: 0 });
  });
});

describe("context assembly orders by trust (AI-003)", () => {
  it("places higher-trust chunks first even when added later", () => {
    const chunks = [
      { content: "من الجامعة", sourceType: "from_university", sourceId: "u", order: 0 },
      { content: "من المركز", sourceType: "from_center", sourceId: "c", order: 1 },
    ];
    const { orderedChunks } = assembleContext(chunks);
    expect(orderedChunks[0]!.sourceType).toBe("from_center");
    expect(orderedChunks[1]!.sourceType).toBe("from_university");
  });
  it("drops chunks that exceed the character budget", () => {
    const chunks = [
      { content: "a".repeat(30), sourceType: "from_center", sourceId: "c", order: 0 },
      { content: "b".repeat(30), sourceType: "from_university", sourceId: "u", order: 1 },
    ];
    const { orderedChunks, droppedForBudget } = assembleContext(chunks, { maxChars: 35 });
    expect(orderedChunks).toHaveLength(1);
    expect(orderedChunks[0]!.sourceType).toBe("from_center"); // highest trust kept
    expect(droppedForBudget).toBe(1);
  });
});

// PROOF (b) + (c): higher-trust override AND conflict surfaced, not silently resolved.
describe("conflict resolution (AI-003)", () => {
  it("(b) a higher-trust source overrides a lower-trust one", () => {
    const claims: Claim[] = [
      { key: "duration", value: "6 أشهر", sourceType: "from_university", sourceId: "u" },
      { key: "duration", value: "4 أشهر", sourceType: "from_center", sourceId: "c" },
    ];
    const { resolved } = resolveClaims(claims);
    const duration = resolved.find((r) => r.key === "duration");
    expect(duration?.value).toBe("4 أشهر"); // from_center (higher trust) wins
    expect(duration?.sourceType).toBe("from_center");
    expect(duration?.resolvedByTrust).toBe(true);
  });

  it("(c) the conflict is surfaced, not silently resolved", () => {
    const claims: Claim[] = [
      { key: "duration", value: "6 أشهر", sourceType: "from_university", sourceId: "u" },
      { key: "duration", value: "4 أشهر", sourceType: "from_center", sourceId: "c" },
    ];
    const { conflicts } = resolveClaims(claims);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.key).toBe("duration");
    expect(conflicts[0]!.winner?.sourceType).toBe("from_center");
    expect(conflicts[0]!.losers.map((l) => l.value)).toContain("6 أشهر");
    expect(conflicts[0]!.needsHuman).toBe(false);
  });

  it("leaves an equal-trust disagreement UNRESOLVED for a human", () => {
    const claims: Claim[] = [
      { key: "name", value: "أ", sourceType: "from_center", sourceId: "c1" },
      { key: "name", value: "ب", sourceType: "from_center", sourceId: "c2" },
    ];
    const { resolved, conflicts } = resolveClaims(claims);
    expect(resolved.find((r) => r.key === "name")).toBeUndefined(); // not auto-resolved
    expect(conflicts[0]!.needsHuman).toBe(true);
    expect(conflicts[0]!.winner).toBeNull();
  });

  it("does not flag agreeing sources as conflicts", () => {
    const claims: Claim[] = [
      { key: "k", value: "v", sourceType: "from_center", sourceId: "c" },
      { key: "k", value: "v", sourceType: "from_university", sourceId: "u" },
    ];
    const { conflicts, resolved } = resolveClaims(claims);
    expect(conflicts).toHaveLength(0);
    expect(resolved).toHaveLength(1);
  });
});
