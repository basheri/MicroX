"use client";

// SC-23 — export package (EP-21). Builds the full submission package ONLY past the
// compliance gate; shows the index (every artifact + its requirement status). RTL.

import { useState } from "react";
import { useActor } from "@/lib/actor";

interface ManifestEntry {
  name: string;
  type: string;
  requirement: string;
  status: string;
}
interface BuildResult {
  packageId: string;
  decision: string;
  fidelityPassed: boolean;
  manifest: ManifestEntry[];
}

export function ExportPackagePanel({
  programId,
  templateVersionId,
}: {
  programId: string;
  templateVersionId: string;
}) {
  const { actor } = useActor();
  const [justification, setJustification] = useState("");
  const [result, setResult] = useState<BuildResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function build() {
    setMessage(null);
    setResult(null);
    const res = await fetch(`/api/programs/${programId}/export-package`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ templateVersionId, justification }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "تعذّر بناء الحزمة.");
    setResult(data.result as BuildResult);
  }

  return (
    <section aria-label="حزمة التصدير">
      <h2>بناء حزمة التصدير</h2>
      <p role="note">
        تُبنى الحزمة فقط بعد اجتياز بوابة التوافق (BR-019). لا تُنشأ رسائل أو خطابات رسمية.
      </p>
      <label>
        تبرير (عند الجودة المنخفضة):
        <textarea
          aria-label="تبرير التصدير"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
      </label>
      <button onClick={build}>بناء الحزمة</button>

      {result && (
        <div role="status">
          <p>تم بناء الحزمة (القرار: {result.decision}).</p>
          <table>
            <caption>فهرس الحزمة</caption>
            <thead>
              <tr>
                <th>الملف</th>
                <th>المتطلب</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {result.manifest.map((m) => (
                <tr key={m.name}>
                  <td dir="ltr">{m.name}</td>
                  <td>{m.requirement}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
