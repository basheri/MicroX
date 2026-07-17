import { describe, it, expect } from "vitest";
import { completeJson, SchemaValidationError } from "@/services/llm/structured";
import type { CompletionResult, LLMProvider } from "@/services/llm/types";

// Provider that returns a scripted sequence of raw outputs — lets us drive the retry path.
class ScriptedProvider implements LLMProvider {
  readonly modelId = "mock/model";
  calls = 0;
  constructor(private readonly outputs: string[]) {}
  async complete(): Promise<CompletionResult> {
    const content = this.outputs[Math.min(this.calls, this.outputs.length - 1)]!;
    this.calls += 1;
    return { content, model: this.modelId, usage: { tokensIn: 5, tokensOut: 3, costUsd: 0.001 } };
  }
  async testConnection() {
    return { ok: true, message: "ok" };
  }
}

const SCHEMA = {
  type: "object",
  required: ["title", "hours"],
  properties: { title: { type: "string" }, hours: { type: "number" } },
  additionalProperties: false,
} as const;

const messages = [{ role: "user" as const, content: "أنشئ مقررًا" }];

// PROOF (a): schema-invalid output is rejected and retried.
describe("schema-constrained generation with retry (AI-002)", () => {
  it("rejects a schema-invalid first output and succeeds on retry", async () => {
    const provider = new ScriptedProvider([
      '{"title":"مقرر"}', // missing required `hours` -> invalid
      '{"title":"مقرر","hours":3}', // valid on retry
    ]);
    const out = await completeJson<{ title: string; hours: number }>(provider, {
      messages,
      schema: SCHEMA as unknown as Record<string, unknown>,
    });
    expect(out.attempts).toBe(2);
    expect(provider.calls).toBe(2);
    expect(out.data).toEqual({ title: "مقرر", hours: 3 });
    // Usage accumulates across attempts (logged with no cap).
    expect(out.usage.tokensIn).toBe(10);
  });

  it("retries on unparseable JSON too", async () => {
    const provider = new ScriptedProvider(["ليس JSON", '{"title":"x","hours":1}']);
    const out = await completeJson(provider, {
      messages,
      schema: SCHEMA as unknown as Record<string, unknown>,
    });
    expect(out.attempts).toBe(2);
  });

  it("throws after exhausting retries when output never validates", async () => {
    const provider = new ScriptedProvider(['{"title":1}', '{"bad":true}', "{}"]);
    await expect(
      completeJson(provider, {
        messages,
        schema: SCHEMA as unknown as Record<string, unknown>,
        maxRetries: 2,
      }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
    expect(provider.calls).toBe(3); // 1 + 2 retries
  });
});
