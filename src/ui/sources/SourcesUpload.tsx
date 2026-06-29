"use client";

// SC-06 — sources & upload. PDF/DOCX/XLSX only, with the mandatory redaction notice
// (SEC-006). RTL Arabic. Real validation/storage happen server-side (SEC-004/007).

import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "@/lib/actor";
import { Bidi } from "@/ui/Bidi";
import type { SourceListItem, SourceType } from "@/data/sourcesRepo";

const ACCEPT = ".pdf,.docx,.xlsx";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "from_center", label: "من المركز" },
  { value: "from_university", label: "من الجامعة" },
  { value: "align_existing", label: "مواءمة برنامج قائم" },
  { value: "professional_sector", label: "من القطاع المهني" },
];

export function SourcesUpload({ programId }: { programId: string }) {
  const { actor } = useActor();
  const [files, setFiles] = useState<SourceListItem[]>([]);
  const [sourceType, setSourceType] = useState<SourceType>("from_center");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/sources`);
    const data = await res.json();
    setFiles(data.files ?? []);
  }, [programId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("الرجاء اختيار ملف.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("sourceType", sourceType);
      const res = await fetch(`/api/programs/${programId}/sources`, {
        method: "POST",
        headers: { "x-actor-name": actor ?? "" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر رفع الملف.");
      if (inputRef.current) inputRef.current.value = "";
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="المصادر والملفات">
      <h2>المصادر والملفات</h2>
      <p role="note">
        المسموح: <Bidi>PDF</Bidi> و<Bidi>DOCX</Bidi> و<Bidi>XLSX</Bidi> فقط. يُزال تلقائيًا أي اسم
        أو هوية أو بريد إلكتروني أو رقم هاتف من المحتوى قبل إرساله إلى النموذج.
      </p>

      <form onSubmit={submit} aria-label="رفع مصدر">
        <input ref={inputRef} type="file" accept={ACCEPT} aria-label="ملف" />
        <select
          aria-label="نوع المصدر"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as SourceType)}
        >
          {SOURCE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy}>
          رفع
        </button>
      </form>
      {error && <p role="alert">{error}</p>}

      <ul aria-label="الملفات المرفوعة">
        {files.map((f) => (
          <li key={f.file_id}>
            {f.original_name} — <Bidi>{f.scan_status}</Bidi>
          </li>
        ))}
      </ul>
    </section>
  );
}
