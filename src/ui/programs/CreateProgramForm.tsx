"use client";

// SC-02 — create a program from name + sector + field ONLY (no cloning). RTL Arabic.

import { useMemo, useState } from "react";
import { useActor } from "@/lib/actor";
import type { Sector, Field } from "@/data/lookupsRepo";

export function CreateProgramForm({
  sectors,
  fields,
  onCreated,
}: {
  sectors: Sector[];
  fields: Field[];
  onCreated?: () => void;
}) {
  const { actor } = useActor();
  const [name, setName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fields are constrained to the chosen sector.
  const sectorFields = useMemo(
    () => fields.filter((f) => f.sector_id === sectorId),
    [fields, sectorId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-actor-name": actor ?? "" },
        body: JSON.stringify({ name, sectorId, fieldId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر إنشاء البرنامج.");
      setName("");
      setSectorId("");
      setFieldId("");
      onCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim() && sectorId && fieldId && !busy;

  return (
    <form onSubmit={submit} aria-label="إنشاء برنامج">
      <h2>إنشاء برنامج جديد</h2>
      <div>
        <label htmlFor="program-name">اسم البرنامج</label>
        <input id="program-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="program-sector">القطاع</label>
        <select
          id="program-sector"
          value={sectorId}
          onChange={(e) => {
            setSectorId(e.target.value);
            setFieldId("");
          }}
        >
          <option value="">— اختر القطاع —</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="program-field">المجال</label>
        <select
          id="program-field"
          value={fieldId}
          onChange={(e) => setFieldId(e.target.value)}
          disabled={!sectorId}
        >
          <option value="">— اختر المجال —</option>
          {sectorFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!canSubmit}>
        إنشاء
      </button>
    </form>
  );
}
