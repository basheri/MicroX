"use client";

// SC-07 — extraction review. Shows each extracted block with its page/location and
// confidence; low-confidence blocks are flagged and BLOCKED from use until the reviewer
// approves, corrects, or rejects them (AI-005 / TC-09). RTL Arabic, Western numerals.

import { useCallback, useEffect, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";
import type { ExtractionRow } from "@/data/extractionRepo";

export function ExtractionReview({ fileId }: { fileId: string }) {
  const { actor } = useActor();
  const [blocks, setBlocks] = useState<ExtractionRow[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/files/${fileId}/extraction`);
    const data = await res.json();
    setBlocks(data.blocks ?? []);
  }, [fileId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function review(contentId: string, status: string, correctedContent?: string) {
    await fetch(`/api/extraction/${contentId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
      body: JSON.stringify({ status, correctedContent }),
    });
    await reload();
  }

  return (
    <section aria-label="مراجعة الاستخراج">
      <h2>مراجعة المحتوى المُستخرج</h2>
      <ul>
        {blocks.map((b) => (
          <li key={b.id} data-testid="block">
            <span>{b.content}</span> <Bidi>{Math.round((b.confidence ?? 0) * 100)}%</Bidi>{" "}
            {b.needs_review && <strong role="status">منخفض الثقة — محجوب حتى المراجعة</strong>}
            {b.needs_review && (
              <span>
                <button onClick={() => review(b.id, "approved")}>اعتماد</button>
                <button onClick={() => review(b.id, "rejected")}>رفض</button>
              </span>
            )}
          </li>
        ))}
        {blocks.length === 0 && <li>لا يوجد محتوى مُستخرج بعد.</li>}
      </ul>
    </section>
  );
}
