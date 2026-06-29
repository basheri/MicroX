// LLM settings + request logging data layer (EP-06). Single active settings row
// (one model at a time, rule 00). The encrypted key is stored as-is and never selected
// into any code path that returns it to the client.

import type { PoolClient } from "pg";
import { getPool } from "@/data/pool";

export interface LlmSettingsRow {
  id: string;
  model_id: string;
  encrypted_api_key: string | null;
  last_tested_at: string | null;
  updated_by_actor: string | null;
  updated_at: string;
}

export async function getSettingsRow(): Promise<LlmSettingsRow | null> {
  const rows = await getPool().query<LlmSettingsRow>(
    "select * from llm_settings order by updated_at desc limit 1",
  );
  return rows.rows[0] ?? null;
}

// Upsert the single settings row. encryptedApiKey === undefined keeps the existing key;
// a string replaces it.
export async function upsertSettings(
  client: PoolClient,
  input: { modelId: string; encryptedApiKey?: string; actor: string },
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    "select id from llm_settings order by updated_at desc limit 1",
  );
  const id = existing.rows[0]?.id;
  if (id) {
    await client.query(
      `update llm_settings
          set model_id = $2,
              encrypted_api_key = coalesce($3, encrypted_api_key),
              updated_by_actor = $4,
              updated_at = now()
        where id = $1`,
      [id, input.modelId, input.encryptedApiKey ?? null, input.actor],
    );
  } else {
    await client.query(
      `insert into llm_settings (model_id, encrypted_api_key, updated_by_actor)
       values ($1, $2, $3)`,
      [input.modelId, input.encryptedApiKey ?? null, input.actor],
    );
  }
}

export async function markTested(modelId: string): Promise<void> {
  await getPool().query(
    `update llm_settings set last_tested_at = now()
      where id = (select id from llm_settings order by updated_at desc limit 1)`,
    [],
  );
  void modelId;
}

// Append-only LLM request log — tokens + cost for transparency. NO cost cap (rule 00).
export async function insertLlmRequest(input: {
  programId?: string | null;
  generationJobId?: string | null;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number | null;
  status: string;
}): Promise<void> {
  await getPool().query(
    `insert into llm_requests
       (program_id, generation_job_id, model, tokens_in, tokens_out, cost, status)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.programId ?? null,
      input.generationJobId ?? null,
      input.model,
      input.tokensIn,
      input.tokensOut,
      input.cost,
      input.status,
    ],
  );
}
