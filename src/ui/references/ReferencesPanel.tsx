"use client";

// SC-17 — references. AR/EN lists with a verified badge; unverifiable references are
// flagged (rejected, not silently included, AI-004). RTL Arabic.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";

interface Reference {
  id: string;
  citation: string;
  language: string | null;
  verified: boolean;
  verification_note: string | null;
}

export function ReferencesPanel({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [references, setReferences] = useState<Reference[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/references`);
    const data = await res.json();
    setReferences(data.references ?? []);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(refId: string) {
    await fetch(`/api/references/${refId}/verify`, {
      method: "POST",
      headers: { "x-actor-name": actor ?? "" },
    });
    await load();
  }

  const arabic = references.filter((r) => r.language === "ar");
  const english = references.filter((r) => r.language === "en");
  const other = references.filter((r) => r.language !== "ar" && r.language !== "en");

  const renderList = (list: Reference[], label: string) => (
    <>
      <h3>{label}</h3>
      <ul>
        {list.map((r) => (
          <li key={r.id}>
            <span dir="auto">{r.citation}</span>{" "}
            {r.verified ? (
              <strong>موثّق ✓</strong>
            ) : (
              <span role="alert">
                غير موثّق — مرفوض{r.verification_note ? `: ${r.verification_note}` : ""}
              </span>
            )}{" "}
            <button onClick={() => verify(r.id)}>تحقّق</button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <section aria-label="المراجع">
      <h2>
        المراجع (<Bidi>{references.length}</Bidi>)
      </h2>
      {renderList(arabic, "المراجع العربية")}
      {renderList(english, "المراجع الإنجليزية")}
      {other.length > 0 && renderList(other, "أخرى")}
    </section>
  );
}
