"use client";

// SC-30 — question bank. Shows the balance status; an unlinked question (no CLO) blocks
// the balance and is flagged (TC-07 / §17). RTL Arabic.

import { useCallback, useEffect, useState } from "react";

interface Issue {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  questionId?: string;
}
interface Balance {
  balanced: boolean;
  issues: Issue[];
}

export function QuestionBankPanel({ bankId }: { bankId: string }) {
  const [balance, setBalance] = useState<Balance | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/question-banks/${bankId}`);
    setBalance(await res.json());
  }, [bankId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!balance) return <p>جارٍ التحميل…</p>;

  const blocking = balance.issues.filter((i) => i.severity === "blocking");
  const warnings = balance.issues.filter((i) => i.severity === "warning");

  return (
    <section aria-label="بنك الأسئلة">
      <h2>توازن بنك الأسئلة</h2>
      <p role="status">
        الحالة: <strong>{balance.balanced ? "متوازن" : "غير متوازن (محجوب)"}</strong>
      </p>

      {blocking.length > 0 && (
        <ul role="alert">
          {blocking.map((i, idx) => (
            <li key={`b${idx}`}>{i.message}</li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul aria-label="تنبيهات">
          {warnings.map((i, idx) => (
            <li key={`w${idx}`}>{i.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
