// JSON-Schema-constrained LLM calls with reject + retry (AI-002). Every structured
// model output is validated against a strict JSON Schema; on a parse/schema violation
// we reject and retry (feeding the error back) before anything is persisted. Throws
// after the retry budget is exhausted — invalid output never escapes this function.

import Ajv, { type ValidateFunction } from "ajv";
import type { ChatMessage, CompletionUsage, LLMProvider } from "@/services/llm/types";

const ajv = new Ajv({ allErrors: true, strict: false });

export class SchemaValidationError extends Error {
  constructor(
    public readonly lastError: string,
    public readonly attempts: number,
  ) {
    super(`فشل التحقق من مخطط الإخراج بعد ${attempts} محاولة: ${lastError}`);
    this.name = "SchemaValidationError";
  }
}

export interface StructuredResult<T> {
  data: T;
  attempts: number;
  usage: CompletionUsage;
}

function addUsage(a: CompletionUsage, b: CompletionUsage): CompletionUsage {
  return {
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    costUsd: a.costUsd === null && b.costUsd === null ? null : (a.costUsd ?? 0) + (b.costUsd ?? 0),
  };
}

export async function completeJson<T = unknown>(
  provider: LLMProvider,
  params: {
    messages: ChatMessage[];
    schema: Record<string, unknown>;
    maxRetries?: number;
    temperature?: number;
  },
): Promise<StructuredResult<T>> {
  const maxRetries = params.maxRetries ?? 2;
  const validate = ajv.compile(params.schema) as ValidateFunction;
  let usage: CompletionUsage = { tokensIn: 0, tokensOut: 0, costUsd: null };
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const messages =
      attempt === 1
        ? params.messages
        : [
            ...params.messages,
            {
              role: "user" as const,
              content: `الإخراج السابق غير صالح: ${lastError}. أعد الإخراج بصيغة JSON صالحة مطابقة للمخطط فقط، دون أي نص إضافي.`,
            },
          ];

    const res = await provider.complete({
      messages,
      temperature: params.temperature,
      responseSchema: params.schema,
    });
    usage = addUsage(usage, res.usage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      lastError = "تعذّر تحليل الإخراج كـ JSON.";
      continue;
    }
    if (validate(parsed)) {
      return { data: parsed as T, attempts: attempt, usage };
    }
    lastError = ajv.errorsText(validate.errors, { separator: "; " });
  }

  throw new SchemaValidationError(lastError, maxRetries + 1);
}
