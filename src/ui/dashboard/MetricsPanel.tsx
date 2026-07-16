"use client";

// SC-03 — dashboard metrics (EP-20). Real DB aggregations rendered as accessible
// tables (not just charts) with counts by stage/approval, plus an Excel export. RTL.

import { useCallback, useEffect, useState } from "react";
import { Bidi } from "@/ui/Bidi";

interface Bucket {
  key: string;
  count: number;
}
interface Metrics {
  programsByStage: Bucket[];
  programsByApproval: Bucket[];
  publishedCount: number;
  totalActivePrograms: number;
  generationJobsByStatus: Bucket[];
  unresolvedFeedback: number;
  exportPackagesByStatus: Bucket[];
  blockingChecks: number;
  auditLast24h: number;
}

function BucketTable({ caption, buckets }: { caption: string; buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <table>
      <caption>{caption}</caption>
      <tbody>
        {buckets.length === 0 && (
          <tr>
            <td>—</td>
            <td>
              <Bidi>0</Bidi>
            </td>
          </tr>
        )}
        {buckets.map((b) => (
          <tr key={b.key}>
            <th scope="row">{b.key}</th>
            <td>
              {/* Simple accessible bar: width ∝ share; the number is the source of truth. */}
              <span
                aria-hidden="true"
                style={{ display: "inline-block", width: `${(b.count / max) * 100}%` }}
              >
                ▮
              </span>{" "}
              <Bidi>{b.count}</Bidi>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/metrics");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "تعذّر تحميل المؤشرات.");
    setMetrics(data.metrics as Metrics);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-label="لوحة المؤشرات">
      <h2>لوحة المؤشرات</h2>
      <p>
        <a href="/api/dashboard/export">تصدير Excel</a>
      </p>
      {error && <p role="alert">{error}</p>}
      {metrics && (
        <div>
          <BucketTable caption="البرامج حسب المرحلة" buckets={metrics.programsByStage} />
          <BucketTable caption="البرامج حسب الاعتماد" buckets={metrics.programsByApproval} />
          <BucketTable caption="مهام التوليد حسب الحالة" buckets={metrics.generationJobsByStatus} />
          <BucketTable caption="حزم التصدير حسب الحالة" buckets={metrics.exportPackagesByStatus} />
          <ul>
            <li>
              إجمالي البرامج النشطة: <Bidi>{metrics.totalActivePrograms}</Bidi>
            </li>
            <li>
              المنشورة: <Bidi>{metrics.publishedCount}</Bidi>
            </li>
            <li>
              ملاحظات غير محلولة: <Bidi>{metrics.unresolvedFeedback}</Bidi>
            </li>
            <li>
              أخطاء توافق حاجبة: <Bidi>{metrics.blockingChecks}</Bidi>
            </li>
            <li>
              نشاط التدقيق (٢٤ ساعة): <Bidi>{metrics.auditLast24h}</Bidi>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
