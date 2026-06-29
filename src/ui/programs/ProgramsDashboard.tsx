"use client";

// SC-03 — dashboard list of programs with filters (sector/field/path/stage/approval)
// and name search. RTL Arabic, Western numerals. Counts shown per the DoD.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Program } from "@/data/programsRepo";
import type { Sector, Field, DevelopmentPath } from "@/data/lookupsRepo";
import { Bidi } from "@/ui/Bidi";
import { STAGE_LABELS, APPROVAL_LABELS, ORDERED_STAGES } from "@/ui/programs/labels";
import type { Stage } from "@/domain/stages";

interface Lookups {
  sectors: Sector[];
  fields: Field[];
  developmentPaths: DevelopmentPath[];
}

export function ProgramsDashboard({ lookups }: { lookups: Lookups }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [filters, setFilters] = useState({
    sectorId: "",
    fieldId: "",
    developmentPathId: "",
    stage: "",
    approvalState: "",
    search: "",
  });

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
    const res = await fetch(`/api/programs?${q.toString()}`);
    const data = await res.json();
    setPrograms(data.programs ?? []);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const sectorFields = useMemo(
    () => lookups.fields.filter((f) => !filters.sectorId || f.sector_id === filters.sectorId),
    [lookups.fields, filters.sectorId],
  );

  const set =
    (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setFilters((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <section aria-label="لوحة البرامج">
      <h2>البرامج ({programs.length})</h2>

      <div role="group" aria-label="عوامل التصفية">
        <select aria-label="القطاع" value={filters.sectorId} onChange={set("sectorId")}>
          <option value="">كل القطاعات</option>
          {lookups.sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="المجال" value={filters.fieldId} onChange={set("fieldId")}>
          <option value="">كل المجالات</option>
          {sectorFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          aria-label="المسار"
          value={filters.developmentPathId}
          onChange={set("developmentPathId")}
        >
          <option value="">كل المسارات</option>
          {lookups.developmentPaths.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="المرحلة" value={filters.stage} onChange={set("stage")}>
          <option value="">كل المراحل</option>
          {ORDERED_STAGES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="الاعتماد" value={filters.approvalState} onChange={set("approvalState")}>
          <option value="">كل حالات الاعتماد</option>
          {Object.entries(APPROVAL_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="بحث بالاسم"
          placeholder="بحث بالاسم"
          value={filters.search}
          onChange={set("search")}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>المرحلة</th>
            <th>الإنجاز</th>
            <th>أخطاء حاجبة</th>
            <th>تنبيهات</th>
            <th>الاعتماد</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{STAGE_LABELS[p.current_stage as Stage] ?? p.current_stage}</td>
              <td>
                <Bidi>{p.completion_pct}%</Bidi>
              </td>
              <td>{p.blocking_errors}</td>
              <td>{p.warnings_count}</td>
              <td>{APPROVAL_LABELS[p.approval_state] ?? p.approval_state}</td>
            </tr>
          ))}
          {programs.length === 0 && (
            <tr>
              <td colSpan={6}>لا توجد برامج مطابقة.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
