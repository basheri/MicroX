"use client";

// SC-25 — templates & Word generation. Fills the ORIGINAL template (never HTML->Word);
// shows the fidelity result. A placeholder banner flags that the official template
// (V-01 fields / V-06 mechanism) is not yet installed. RTL Arabic.

import { useState } from "react";
import { useActor } from "@/lib/actor";

interface GenResult {
  docId: string;
  fidelityPassed: boolean;
  missingRequired: string[];
  isPlaceholder: boolean;
}

export function TemplatesPanel({ programId, versionId }: { programId: string; versionId: string }) {
  const { actor } = useActor();
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    const res = await fetch(`/api/programs/${programId}/document`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "تعذّر التوليد.");
      return;
    }
    setResult(data.result);
  }

  return (
    <section aria-label="القوالب وتوليد Word">
      <h2>القوالب وتوليد الوثيقة</h2>
      <p role="note">
        يُملأ القالب الأصلي مباشرةً (لا تحويل HTML إلى Word). القالب الرسمي (حقول V-01 وآلية V-06)
        لم يُركَّب بعد — تُستخدم حاليًا نسخة بديلة معلّمة.
      </p>
      <button onClick={generate}>توليد الوثيقة</button>
      {result && (
        <div role="status">
          <p>الأمانة (Fidelity): {result.fidelityPassed ? "ناجحة ✓" : "فشلت"}</p>
          {result.missingRequired.length > 0 && (
            <p>
              حقول مطلوبة ناقصة (بانتظار القالب الرسمي V-01): {result.missingRequired.join("، ")}
            </p>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
