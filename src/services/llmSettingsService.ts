// LLM settings service (EP-06). Owns the single active model + encrypted key, the
// mandatory connection test, the configured-provider factory, and request logging.
// The full API key is NEVER returned to callers — only a masked form (SEC-002).

import { withAudit } from "@/lib/audit";
import { withTransaction } from "@/data/pool";
import { PgAuditSink } from "@/data/pgAuditSink";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import {
  getSettingsRow,
  upsertSettings,
  markTested,
  insertLlmRequest,
} from "@/data/llmSettingsRepo";
import { OpenRouterProvider } from "@/services/llm/openRouterProvider";
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResult,
  ConnectionTestResult,
  HttpClient,
} from "@/services/llm/types";

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("لم يتم ضبط النموذج ومفتاح OpenRouter في الإعدادات بعد.");
    this.name = "LlmNotConfiguredError";
  }
}

export interface MaskedSettings {
  modelId: string | null;
  maskedKey: string;
  hasKey: boolean;
  lastTestedAt: string | null;
}

// Read settings for the UI — masked key only (never the plaintext).
export async function getMaskedSettings(): Promise<MaskedSettings> {
  const row = await getSettingsRow();
  if (!row) return { modelId: null, maskedKey: "", hasKey: false, lastTestedAt: null };
  const hasKey = !!row.encrypted_api_key;
  return {
    modelId: row.model_id,
    maskedKey: hasKey ? maskSecret(decryptSecret(row.encrypted_api_key!)) : "",
    hasKey,
    lastTestedAt: row.last_tested_at,
  };
}

// Save the model and (optionally) a new key. A missing/blank apiKey keeps the existing
// key. The plaintext key is never written to the audit log — only whether it changed.
export async function saveSettings(
  input: { modelId: string; apiKey?: string },
  actor: string,
): Promise<MaskedSettings> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  if (!input.modelId?.trim()) throw new Error("معرّف النموذج مطلوب.");
  const encryptedApiKey =
    input.apiKey && input.apiKey.trim() ? encryptSecret(input.apiKey.trim()) : undefined;

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "llm_settings.save",
        new_value: { modelId: input.modelId, keyChanged: !!encryptedApiKey },
      },
      async () => {
        await upsertSettings(client, { modelId: input.modelId.trim(), encryptedApiKey, actor });
      },
      sink,
    );
  });
  return getMaskedSettings();
}

// Build the configured provider from settings (model + decrypted key). Throws if unset.
export async function getConfiguredProvider(http?: HttpClient): Promise<LLMProvider> {
  const row = await getSettingsRow();
  if (!row || !row.encrypted_api_key) throw new LlmNotConfiguredError();
  return new OpenRouterProvider(
    { modelId: row.model_id, apiKey: decryptSecret(row.encrypted_api_key) },
    http,
  );
}

// Mandatory connection test (AI-007). providerOverride lets tests inject a mock so the
// live API is never called. Records last_tested_at on success; audits the attempt.
export async function testConnection(
  actor: string,
  providerOverride?: LLMProvider,
): Promise<ConnectionTestResult> {
  if (!actor?.trim()) throw new Error("actor_name is required — no anonymous writes (rule 00).");
  let provider: LLMProvider;
  try {
    provider = providerOverride ?? (await getConfiguredProvider());
  } catch {
    return { ok: false, message: "يجب ضبط النموذج والمفتاح في الإعدادات أولًا." };
  }

  const result = await provider.testConnection();
  if (result.ok) await markTested(provider.modelId);

  await withTransaction(async (client) => {
    const sink = new PgAuditSink(client);
    await withAudit(
      {
        actor_name: actor,
        operation_type: "llm_settings.test",
        llm_model: provider.modelId,
        new_value: { ok: result.ok },
      },
      async () => {},
      sink,
    );
  });
  return result;
}

// Run a completion through the configured provider and log tokens/cost (no cap).
export async function runCompletion(
  req: CompletionRequest,
  ctx: { programId?: string | null; generationJobId?: string | null } = {},
  providerOverride?: LLMProvider,
): Promise<CompletionResult> {
  const provider = providerOverride ?? (await getConfiguredProvider());
  try {
    const result = await provider.complete(req);
    await insertLlmRequest({
      programId: ctx.programId ?? null,
      generationJobId: ctx.generationJobId ?? null,
      model: result.model,
      tokensIn: result.usage.tokensIn,
      tokensOut: result.usage.tokensOut,
      cost: result.usage.costUsd,
      status: "success",
    });
    return result;
  } catch (err) {
    await insertLlmRequest({
      programId: ctx.programId ?? null,
      generationJobId: ctx.generationJobId ?? null,
      model: provider.modelId,
      tokensIn: 0,
      tokensOut: 0,
      cost: null,
      status: "error",
    });
    throw err;
  }
}
