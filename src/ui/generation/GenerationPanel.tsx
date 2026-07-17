"use client";

// SC-11-ish — generation panel. Shows generated sections as PREVIEWS that the user
// must explicitly apply (no silent changes); impact analysis is read-only. RTL Arabic.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";

interface Section {
  id: string;
  section_key: string;
  status: string;
  is_pinned: boolean;
}

export function GenerationPanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [sections, setSections] = useState<Section[]>([]);
  const [impact, setImpact] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/generation`);
    const data = await res.json();
    setSections(data.sections ?? []);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sectionAction(sectionId: string, action: string) {
    await fetch(`/api/generation/sections/${sectionId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  async function runImpact(changedSectionKey: string) {
    const res = await fetch(`/api/programs/${programId}/impact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changedSectionKey }),
    });
    const data = await res.json();
    setImpact(data.affectedKeys ?? []);
  }

  return (
    <section aria-label="مولّد البرنامج">
      <h2>الأقسام المُولّدة</h2>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <span>{s.section_key}</span> —{" "}
            <strong>{s.status === "applied" ? "مُطبّق" : "معاينة"}</strong>
            {s.status === "previewed" && (
              <button onClick={() => sectionAction(s.id, "apply")}>تطبيق بعد المعاينة</button>
            )}
            <button onClick={() => sectionAction(s.id, s.is_pinned ? "unpin" : "pin")}>
              {s.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
            </button>
            <button onClick={() => runImpact(s.section_key)}>تحليل الأثر</button>
          </li>
        ))}
        {sections.length === 0 && <li>لا توجد أقسام مُولّدة بعد.</li>}
      </ul>
      {impact && <p role="status">الأقسام المتأثرة (دون تطبيق): {impact.join("، ")}</p>}
    </section>
  );
}
