// Mock LLMProvider for local development and tests (no live OpenRouter calls).
// Demonstrates that business logic depends only on the LLMProvider interface (D-02):
// the same calling code works against OpenRouter or this mock.

import type {
  CompletionRequest,
  CompletionResult,
  ConnectionTestResult,
  LLMProvider,
} from "@/services/llm/types";

export class MockLLMProvider implements LLMProvider {
  constructor(
    readonly modelId: string = "mock/model",
    private readonly canned: string = "(استجابة تجريبية)",
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    return {
      content: this.canned,
      model: this.modelId,
      usage: {
        tokensIn: (lastUser?.content.length ?? 0) >> 2,
        tokensOut: this.canned.length >> 2,
        costUsd: 0,
      },
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, model: this.modelId, message: "اتصال تجريبي ناجح (Mock)." };
  }
}
