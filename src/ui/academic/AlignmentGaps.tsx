"use client";

// SC-20 — alignment matrix gaps. Surfaces TC-06 detectors: outcomes not covered and
// content not linked to an outcome. Warnings (gaps in the chain), not blockers. RTL.

import { useCallback, useEffect, useState } from "react";

interface Gaps {
  uncoveredPLOs: { id: string; statement: string }[];
  uncoveredCLOs: { id: string; statement: string }[];
  contentWithoutOutcome: { id: string; title: string }[];
}

export function AlignmentGaps({ programId }: { programId: string }) {
  const [gaps, setGaps] = useState<Gaps | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/alignment`);
    const data = await res.json();
    setGaps(data.gaps);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!gaps) return <p>جارٍ التحميل…</p>;

  const total =
    gaps.uncoveredPLOs.length + gaps.uncoveredCLOs.length + gaps.contentWithoutOutcome.length;

  return (
    <section aria-label="فجوات المواءمة">
      <h2>فجوات المواءمة</h2>
      {total === 0 ? (
        <p role="status">لا توجد فجوات في سلسلة المواءمة.</p>
      ) : (
        <div role="alert">
          <h3>مخرجات غير مغطاة ({gaps.uncoveredPLOs.length + gaps.uncoveredCLOs.length})</h3>
          <ul>
            {[...gaps.uncoveredPLOs, ...gaps.uncoveredCLOs].map((o) => (
              <li key={o.id}>{o.statement}</li>
            ))}
          </ul>
          <h3>محتوى غير مرتبط بمخرج ({gaps.contentWithoutOutcome.length})</h3>
          <ul>
            {gaps.contentWithoutOutcome.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
