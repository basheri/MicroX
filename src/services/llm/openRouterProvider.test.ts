import { describe, it, expect } from "vitest";
import { OpenRouterProvider } from "@/services/llm/openRouterProvider";
import type { HttpClient, HttpResponse } from "@/services/llm/types";

function http(handler: (url: string) => HttpResponse): HttpClient {
  return async (url) => handler(url);
}
const res = (ok: boolean, status: number, body: unknown): HttpResponse => ({
  ok,
  status,
  json: async () => body,
});

const cfg = { modelId: "anthropic/claude-3.5-sonnet", apiKey: "sk-test" };

describe("OpenRouterProvider (D-02 / AI-007)", () => {
  it("completes and surfaces usage (tokens + cost)", async () => {
    const provider = new OpenRouterProvider(
      cfg,
      http(() =>
        res(true, 200, {
          model: cfg.modelId,
          choices: [{ message: { content: "مرحبا" } }],
          usage: { prompt_tokens: 12, completion_tokens: 7, cost: 0.0009 },
        }),
      ),
    );
    const out = await provider.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(out.content).toBe("مرحبا");
    expect(out.usage).toEqual({ tokensIn: 12, tokensOut: 7, costUsd: 0.0009 });
    expect(provider.modelId).toBe(cfg.modelId);
  });

  it("throws on a non-OK completion", async () => {
    const provider = new OpenRouterProvider(
      cfg,
      http(() => res(false, 500, {})),
    );
    await expect(provider.complete({ messages: [] })).rejects.toThrow(/HTTP 500/);
  });

  it("reports a successful connection test", async () => {
    const provider = new OpenRouterProvider(
      cfg,
      http(() => res(true, 200, { data: [] })),
    );
    const r = await provider.testConnection();
    expect(r.ok).toBe(true);
    expect(r.model).toBe(cfg.modelId);
  });

  it("reports an auth failure clearly", async () => {
    const provider = new OpenRouterProvider(
      cfg,
      http(() => res(false, 401, {})),
    );
    const r = await provider.testConnection();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/المصادقة/);
  });
});
