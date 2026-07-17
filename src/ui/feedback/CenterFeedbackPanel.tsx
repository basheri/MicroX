"use client";

// Center feedback panel (EP-18). Shows change proposals as before/after PREVIEWS;
// applying is an explicit approved step that creates a program version. Strict RTL.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Proposal {
  id: string;
  section_ref: string | null;
  old_text: string | null;
  new_text: string | null;
  reason: string | null;
  decision: string | null;
  applied_version_no: number | null;
}

const DECISION_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  applied: "مُطبَّق",
  rejected: "مرفوض",
};

export function CenterFeedbackPanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/feedback`);
    const data = await res.json();
    setProposals(data.proposals ?? []);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "apply" | "reject") {
    setMessage(null);
    const res = await fetch(`/api/feedback/proposals/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "تعذّر تنفيذ الإجراء.");
    if (action === "apply")
      setMessage(`طُبِّق المقترح وأُنشئت نسخة ${data.result.appliedVersionNo}.`);
    await load();
  }

  return (
    <section aria-label="ملاحظات المركز">
      <h2>ملاحظات المركز والمقترحات</h2>
      <p role="note">
        كل مقترح يُعرض كمعاينة (قبل/بعد) ولا يُطبَّق إلا بموافقة صريحة؛ التطبيق يُنشئ نسخة جديدة.
      </p>
      <ul>
        {proposals.map((p) => (
          <li key={p.id}>
            <div>الموضع: {p.section_ref ?? "—"}</div>
            <div>
              قبل: <span dir="auto">{p.old_text ?? "—"}</span>
            </div>
            <div>
              بعد: <span dir="auto">{p.new_text ?? "—"}</span>
            </div>
            <div>
              الحالة: {DECISION_AR[p.decision ?? "pending"]}
              {p.applied_version_no != null && (
                <>
                  {" "}
                  (نسخة <Bidi>{p.applied_version_no}</Bidi>)
                </>
              )}
            </div>
            {p.decision === "pending" && (
              <div>
                <button onClick={() => decide(p.id, "apply")}>تطبيق</button>
                <button onClick={() => decide(p.id, "reject")}>رفض</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
