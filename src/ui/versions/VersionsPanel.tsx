"use client";

// SC-21 / SC-24 — versions (EP-19). Snapshots, publish lock (BR-020), restore as a new
// version. A published version is immutable; editing opens a new update cycle. RTL.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Version {
  id: string;
  version_no: number;
  trigger_event: string;
  created_by_actor: string | null;
  created_at: string;
}

const TRIGGER_AR: Record<string, string> = {
  publish: "نشر",
  update_cycle_open: "فتح دورة تحديث",
  restore: "استرجاع",
  "feedback.apply": "تطبيق ملاحظة",
};

export function VersionsPanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [versions, setVersions] = useState<Version[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/versions`);
    const data = await res.json();
    setVersions(data.versions ?? []);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, versionNo?: number) {
    setMessage(null);
    const res = await fetch(`/api/programs/${programId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ action, versionNo }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "تعذّر تنفيذ الإجراء.");
    setMessage(`تم — النسخة ${data.result.versionNo}.`);
    await load();
  }

  return (
    <section aria-label="النسخ">
      <h2>النسخ والنشر</h2>
      <p role="note">
        النسخة المنشورة مقفلة وغير قابلة للتعديل (القاعدة BR-020). أي تعديل يفتح دورة تحديث جديدة؛
        الاسترجاع يُنشئ نسخة جديدة ولا يمسح التاريخ.
      </p>
      <div>
        <button onClick={() => act("publish")}>نشر</button>
        <button onClick={() => act("openCycle")}>فتح دورة تحديث</button>
      </div>
      <ul>
        {versions.map((v) => (
          <li key={v.id}>
            نسخة <Bidi>{v.version_no}</Bidi> — {TRIGGER_AR[v.trigger_event] ?? v.trigger_event} (
            {v.created_by_actor ?? "—"}){" "}
            <button onClick={() => act("restore", v.version_no)}>استرجاع</button>
          </li>
        ))}
      </ul>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
