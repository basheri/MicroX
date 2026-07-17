"use client";

// SC-27 — OpenRouter / LLM settings. One active model, set here only (rule 00). The key
// is write-only: the field shows the masked stored key and is replaced only if retyped.
// A connection test gives a clear pass/fail. RTL Arabic.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface MaskedSettings {
  modelId: string | null;
  maskedKey: string;
  hasKey: boolean;
  lastTestedAt: string | null;
}

export function LlmSettings() {
  const { actor } = useActor();
  const [settings, setSettings] = useState<MaskedSettings | null>(null);
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/llm");
    const data: MaskedSettings = await res.json();
    setSettings(data);
    setModelId(data.modelId ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ modelId, apiKey: apiKey || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "تعذّر الحفظ.");
      return;
    }
    setApiKey("");
    setSettings(data);
    setStatus("تم الحفظ.");
  }

  async function test() {
    setStatus("جارٍ اختبار الاتصال…");
    const res = await fetch("/api/settings/llm/test", {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    const data = await res.json();
    setStatus(data.message ?? (data.ok ? "نجح الاتصال." : "فشل الاتصال."));
  }

  return (
    <section aria-label="إعدادات النموذج">
      <h2>إعدادات النموذج (OpenRouter)</h2>
      <form onSubmit={save}>
        <div>
          <label htmlFor="model-id">معرّف النموذج</label>
          <input
            id="model-id"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="مثال: anthropic/claude-3.5-sonnet"
          />
        </div>
        <div>
          <label htmlFor="api-key">مفتاح OpenRouter</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.hasKey ? settings.maskedKey : "أدخل المفتاح"}
            aria-describedby="key-hint"
          />
          <small id="key-hint">
            {settings?.hasKey ? (
              <>
                مفتاح محفوظ: <Bidi>{settings.maskedKey}</Bidi> (لن يُعرض كاملًا)
              </>
            ) : (
              "لا يوجد مفتاح محفوظ بعد."
            )}
          </small>
        </div>
        <button type="submit">حفظ</button>
        <button type="button" onClick={test}>
          اختبار الاتصال
        </button>
      </form>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
