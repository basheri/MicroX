// LLMProvider abstraction (D-02 / rule 00). All model access goes through this; the
// model id lives in Settings, never hard-coded in logic. Swapping the model never
// touches business logic or data — callers depend only on these interfaces.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  // JSON-Schema-constrained output is wired in EP-07 (AI-002); accepted here as opaque.
  responseSchema?: Record<string, unknown>;
}

export interface CompletionUsage {
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null; // logged for transparency only — NO cost cap (rule 00)
}

export interface CompletionResult {
  content: string;
  model: string;
  usage: CompletionUsage;
}

export interface ConnectionTestResult {
  ok: boolean;
  model?: string;
  message: string;
}

export interface LLMProvider {
  readonly modelId: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  testConnection(): Promise<ConnectionTestResult>;
}

// Minimal HTTP seam so the provider is testable without calling the live API.
export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type HttpClient = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<HttpResponse>;
