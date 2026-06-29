// OpenRouter implementation of LLMProvider (D-02 / AI-007). OpenRouter is the single
// LLM gateway. The HTTP client is injectable so this is fully testable without ever
// calling the live API (the real key/model are supplied later, at EP-23).

import type {
  CompletionRequest,
  CompletionResult,
  ConnectionTestResult,
  HttpClient,
  HttpResponse,
  LLMProvider,
} from "@/services/llm/types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const defaultHttp: HttpClient = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<HttpResponse>;

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}
interface OpenRouterCompletion {
  model?: string;
  choices?: OpenRouterChoice[];
  usage?: OpenRouterUsage;
}

export class OpenRouterProvider implements LLMProvider {
  readonly modelId: string;
  constructor(
    private readonly config: { modelId: string; apiKey: string },
    private readonly http: HttpClient = defaultHttp,
  ) {
    this.modelId = config.modelId;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const res = await this.http(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.modelId,
        messages: req.messages,
        temperature: req.temperature,
        ...(req.responseSchema
          ? { response_format: { type: "json_schema", json_schema: req.responseSchema } }
          : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter completion failed (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as OpenRouterCompletion;
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model ?? this.modelId,
      usage: {
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        costUsd: data.usage?.cost ?? null,
      },
    };
  }

  // Lightweight connectivity + auth check (AI-007), used by the mandatory test endpoint.
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const res = await this.http(`${OPENROUTER_BASE}/models`, { headers: this.headers() });
      if (res.ok) {
        return { ok: true, model: this.modelId, message: "تم الاتصال بنجاح بـ OpenRouter." };
      }
      if (res.status === 401) {
        return { ok: false, message: "فشل المصادقة: مفتاح OpenRouter غير صحيح." };
      }
      return { ok: false, message: `تعذّر الاتصال بـ OpenRouter (HTTP ${res.status}).` };
    } catch (err) {
      return { ok: false, message: `خطأ في الاتصال: ${(err as Error).message}` };
    }
  }
}
