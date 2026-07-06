"use client";

// SC-15 — hours & schedule. Live totals + weekly load; violations (BR-002/005) shown in
// clear Arabic; setting weeks that push weekly load > 15 is blocked. Western numerals.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Recompute {
  totalCredit: number;
  totalActual: number;
  weeks: number | null;
  weeklyLoad: number | null;
  issues: { ruleCode: string; message: string }[];
}

export function HoursSchedule({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [data, setData] = useState<Recompute | null>(null);
  const [weeks, setWeeks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/schedule`);
    setData(await res.json());
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/programs/${programId}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ weeks: Number(weeks) }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "تعذّر الحفظ.");
      return;
    }
    await load();
  }

  if (!data) return <p>جارٍ التحميل…</p>;

  return (
    <section aria-label="الساعات والجدولة">
      <h2>الساعات والجدولة</h2>
      <p>
        إجمالي الساعات المعتمدة: <Bidi>{data.totalCredit}</Bidi> · إجمالي الساعات الفعلية:{" "}
        <Bidi>{data.totalActual}</Bidi>
      </p>
      <p>
        الأسابيع: <Bidi>{data.weeks ?? "—"}</Bidi> · الحمل الأسبوعي:{" "}
        <Bidi>{data.weeklyLoad ?? "—"}</Bidi> ساعة/أسبوع
      </p>

      {data.issues.length > 0 && (
        <ul role="alert">
          {data.issues.map((i) => (
            <li key={i.ruleCode}>{i.message}</li>
          ))}
        </ul>
      )}

      <form onSubmit={save} aria-label="تحديد الأسابيع">
        <label htmlFor="weeks">عدد الأسابيع</label>
        <input
          id="weeks"
          type="number"
          min={1}
          value={weeks}
          onChange={(e) => setWeeks(e.target.value)}
        />
        <button type="submit" disabled={!weeks}>
          حفظ الجدولة
        </button>
      </form>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
