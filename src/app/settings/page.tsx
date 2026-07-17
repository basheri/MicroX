// SC-27 — OpenRouter / LLM settings (model + encrypted key + connection test).
import { ActorGate } from "@/ui/ActorGate";
import { LlmSettings } from "@/ui/settings/LlmSettings";

export default function SettingsPage() {
  return (
    <ActorGate>
      <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>الإعدادات</h1>
        <LlmSettings />
      </main>
    </ActorGate>
  );
}
