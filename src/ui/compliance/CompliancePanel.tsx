"use client";

// SC-18 — compliance panel & export gate (EP-16 / BR-019). Runs the data-driven
// rules engine, shows checks classified as blocking/warning/suggestion, and gates
// export: a blocking failure prevents export; a low-quality failure requires a
// justification (saved to the audit log). RTL Arabic.

import { useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

type Severity = "blocking" | "warning" | "suggestion";

interface CheckResult {
  ruleCode: string;
  severity: Severity;
  passed: boolean;
  message: string;
}

interface RunResult {
  decision: "blocked" | "needs_justification" | "clear";
  results: CheckResult[];
}

const SEVERITY_LABEL: Record<Severity, string> = {
  blocking: "خطأ إلزامي (يمنع التصدير)",
  warning: "تحذير",
  suggestion: "اقتراح",
};

export function CompliancePanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [run, setRun] = useState<RunResult | null>(null);
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function runChecks() {
    setMessage(null);
    const res = await fetch(`/api/programs/${programId}/compliance`, {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "تعذّر الفحص.");
    setRun(data.result as RunResult);
  }

  async function exportPackage() {
    setMessage(null);
    const res = await fetch(`/api/programs/${programId}/export`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ justification }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("تم إنشاء حزمة التصدير ✓");
      return;
    }
    // 409 blocked, 422 needs justification — surface the reason.
    setMessage(data.error ?? "تعذّر التصدير.");
  }

  const failures = (run?.results ?? []).filter((r) => !r.passed);
  const lowQuality = run?.decision === "needs_justification";

  return (
    <section aria-label="التوافق والتصدير">
      <h2>التوافق وبوابة التصدير</h2>
      <p role="note">
        قائمة الحقول الإلزامية الرسمية (V-05) لم تُعتمد بعد — بعض القواعد مؤقتة ومعلّمة. القواعد
        قابلة للتحرير في قاعدة البيانات دون إعادة بناء.
      </p>
      <button onClick={runChecks}>فحص التوافق</button>

      {run && (
        <div role="status">
          <p>
            القرار:{" "}
            {run.decision === "blocked"
              ? "محظور — يوجد خطأ إلزامي"
              : run.decision === "needs_justification"
                ? "مسموح بشرط تبرير (جودة منخفضة)"
                : "مطابق ✓"}
          </p>
          {failures.length > 0 && (
            <ul>
              {failures.map((f) => (
                <li key={f.ruleCode} role={f.severity === "blocking" ? "alert" : undefined}>
                  [<Bidi>{f.ruleCode}</Bidi>] {SEVERITY_LABEL[f.severity]}: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {run && run.decision !== "blocked" && (
        <div>
          {lowQuality && (
            <label>
              تبرير التصدير رغم الجودة المنخفضة (يُحفظ في سجل التدقيق):
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                aria-label="تبرير التصدير"
              />
            </label>
          )}
          <button onClick={exportPackage}>تصدير الحزمة</button>
        </div>
      )}

      {message && <p role="alert">{message}</p>}
    </section>
  );
}
