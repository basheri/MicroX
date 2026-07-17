"use client";

// SC-08 / SC-09 — market analysis + feasibility. Shows the summary, skills, cited
// sources, and feasibility rating; the analyst approves it (the precondition for
// generation). RTL Arabic, Western numerals.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

const RATING_LABELS: Record<string, string> = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
  insufficient_evidence: "أدلة غير كافية",
};

interface MarketData {
  analysis: {
    id: string;
    summary: string | null;
    feasibility_rating: string | null;
    is_approved: boolean;
  };
  skills: { skill: string; demand_level: string | null }[];
  sources: { url: string | null; title: string | null; reliability: string | null }[];
}

export function MarketAnalysis({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/market`);
    const data = await res.json();
    setMarket(data.market);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!market) return;
    const res = await fetch(`/api/market/${market.analysis.id}/approve`, {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    if (res.ok) {
      setStatus("تم اعتماد التحليل. يمكن الآن توليد البرنامج.");
      await load();
    } else {
      setStatus("تعذّر الاعتماد.");
    }
  }

  if (!market) return <p>لا يوجد تحليل سوق عمل بعد.</p>;

  return (
    <section aria-label="تحليل سوق العمل">
      <h2>تحليل سوق العمل</h2>
      <p>{market.analysis.summary}</p>
      <p>
        الجدوى: <strong>{RATING_LABELS[market.analysis.feasibility_rating ?? ""] ?? "—"}</strong>
      </p>

      <h3>المهارات المطلوبة ({market.skills.length})</h3>
      <ul>
        {market.skills.map((s, i) => (
          <li key={i}>
            {s.skill}
            {s.demand_level ? ` — ${s.demand_level}` : ""}
          </li>
        ))}
      </ul>

      <h3>المصادر ({market.sources.length})</h3>
      <ul>
        {market.sources.map((s, i) => (
          <li key={i}>
            {s.title ?? "مصدر"} {s.url ? <Bidi>{s.url}</Bidi> : null}
          </li>
        ))}
      </ul>

      {market.analysis.is_approved ? (
        <p role="status">معتمد ✓</p>
      ) : (
        <button onClick={approve}>اعتماد التحليل</button>
      )}
      {status && <p role="alert">{status}</p>}
    </section>
  );
}
