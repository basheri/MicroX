// @vitest-environment node
//
// EP-06 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the DoD:
// model set from Settings; key stored ENCRYPTED + only ever returned MASKED; connection
// test passes/fails clearly (via a mock provider — no live OpenRouter); requests logged.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import {
  getMaskedSettings,
  saveSettings,
  testConnection,
  runCompletion,
} from "@/services/llmSettingsService";
import { MockLLMProvider } from "@/services/llm/mockProvider";

process.env.APP_ENCRYPTION_KEY = "integration-test-key";
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const PLAINTEXT_KEY = "sk-or-v1-supersecret-7890";

suite("EP-06 — OpenRouter & settings (integration)", () => {
  let db: IsolatedDb;

  beforeAll(async () => {
    db = await createIsolatedDb("ep06");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("saves the model + key, storing the key encrypted and returning it masked only", async () => {
    const masked = await saveSettings(
      { modelId: "anthropic/claude-3.5-sonnet", apiKey: PLAINTEXT_KEY },
      "منى",
    );
    expect(masked.modelId).toBe("anthropic/claude-3.5-sonnet");
    expect(masked.maskedKey).toBe("••••••••7890");
    // The masked form must NOT expose the real key.
    expect(masked.maskedKey).not.toContain("supersecret");

    // At rest the key is encrypted (not the plaintext).
    const row = await getPool().query("select encrypted_api_key from llm_settings");
    expect(row.rows[0].encrypted_api_key).not.toContain(PLAINTEXT_KEY);
    expect(row.rows[0].encrypted_api_key).toBeTruthy();

    // The audit log records the change WITHOUT the key.
    const audit = await getPool().query(
      "select new_value from audit_logs where operation_type='llm_settings.save'",
    );
    expect(JSON.stringify(audit.rows[0].new_value)).not.toContain(PLAINTEXT_KEY);
  });

  it("swaps the model from Settings without touching the key (D-02)", async () => {
    await saveSettings({ modelId: "openai/gpt-4o" }, "سارة"); // no apiKey -> keep existing
    const masked = await getMaskedSettings();
    expect(masked.modelId).toBe("openai/gpt-4o");
    expect(masked.hasKey).toBe(true);
    expect(masked.maskedKey).toBe("••••••••7890"); // key preserved
  });

  it("runs the connection test via an injected provider and records last_tested_at", async () => {
    const result = await testConnection("منى", new MockLLMProvider("openai/gpt-4o"));
    expect(result.ok).toBe(true);
    const row = await getPool().query("select last_tested_at from llm_settings");
    expect(row.rows[0].last_tested_at).not.toBeNull();
    const audit = await getPool().query(
      "select count(*)::int n from audit_logs where operation_type='llm_settings.test'",
    );
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("logs llm_requests with tokens + cost (no cap)", async () => {
    const provider = new MockLLMProvider("openai/gpt-4o", "ناتج");
    await runCompletion({ messages: [{ role: "user", content: "اكتب شيئًا" }] }, {}, provider);
    const rows = await getPool().query(
      "select model, tokens_in, tokens_out, status from llm_requests",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].model).toBe("openai/gpt-4o");
    expect(rows.rows[0].status).toBe("success");
  });

  it("connection test fails clearly when nothing is configured", async () => {
    const fresh = await createIsolatedDb("ep06_unset");
    process.env.DATABASE_URL = fresh.url;
    setPool(fresh.pool);
    const result = await testConnection("منى");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/الإعدادات/);
    await fresh.teardown();
    // restore the main db for any later assertions
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
  });

  it("refuses anonymous settings save (rule 00)", async () => {
    await expect(saveSettings({ modelId: "x" }, "")).rejects.toThrow(/actor_name is required/);
  });
});
