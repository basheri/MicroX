"use client";

// SC-19 — quality panel (EP-17). Six-axis scores with evidence and an overall score.
// Quality is ADVISORY: low scores are WARNINGS shown clearly as "does not block export"
// (BR-019). Strict Arabic RTL, Western numerals.

import { useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

type Confidence = "low" | "medium" | "high";

interface AxisScore {
  key: string;
  label: string;
  kind: "deterministic" | "llm_assist";
  weight: number;
  score: number;
  confidence: Confidence | null;
  isWarning: boolean;
  insufficientData: boolean;
  evidence: string[];
}

interface QualityResult {
  overall: number;
  axes: AxisScore[];
  warnings: AxisScore[];
  blocksExport: boolean;
}

const CONFIDENCE_AR: Record<Confidence, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

export function QualityPanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [result, setResult] = useState<QualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assess() {
    setError(null);
    const res = await fetch(`/api/programs/${programId}/quality`, {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "تعذّر التقييم.");
    setResult(data.result as QualityResult);
  }

  return (
    <section aria-label="جودة البرنامج">
      <h2>جودة البرنامج (ستة محاور)</h2>
      <p role="note">
        الجودة استشارية: الدرجات المنخفضة تُعرض كتحذيرات ولا تمنع التصدير (القاعدة BR-019). المنع
        يكون من محرك التوافق فقط.
      </p>
      <button onClick={assess}>تقييم الجودة</button>

      {result && (
        <div role="status">
          <p>
            النتيجة الإجمالية: <Bidi>{result.overall}</Bidi> / <Bidi>100</Bidi>
          </p>
          <ul>
            {result.axes.map((a) => (
              <li key={a.key} role={a.isWarning ? "alert" : undefined}>
                <strong>{a.label}</strong>: <Bidi>{a.score}</Bidi>/<Bidi>100</Bidi>
                {a.kind === "llm_assist" && a.confidence
                  ? ` (ثقة: ${CONFIDENCE_AR[a.confidence]})`
                  : ""}
                {a.insufficientData ? " — بيانات غير كافية" : a.isWarning ? " — تحذير" : " ✓"}
                {a.evidence.length > 0 && <div>{a.evidence.join("، ")}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
