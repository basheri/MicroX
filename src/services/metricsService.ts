// Dashboard metrics service (EP-20). Exposes the real DB aggregations and builds an
// Excel (.xlsx) export of them. Read-only — no audit needed (no writes).

import { getDashboardMetrics, type DashboardMetrics } from "@/data/metricsRepo";
import { buildXlsx, type Cell } from "@/services/xlsx/xlsxWriter";

export type { DashboardMetrics };

export function getMetrics(): Promise<DashboardMetrics> {
  return getDashboardMetrics();
}

// Flatten the metrics into labeled rows and build a single-sheet .xlsx (Arabic RTL).
export async function exportMetricsXlsx(): Promise<Uint8Array> {
  const m = await getDashboardMetrics();
  const rows: Cell[][] = [["المؤشر", "التصنيف", "العدد"]];

  const section = (label: string, buckets: { key: string; count: number }[]) => {
    if (buckets.length === 0) rows.push([label, "—", 0]);
    for (const b of buckets) rows.push([label, b.key, b.count]);
  };

  section("البرامج حسب المرحلة", m.programsByStage);
  section("البرامج حسب الاعتماد", m.programsByApproval);
  section("مهام التوليد حسب الحالة", m.generationJobsByStatus);
  section("حزم التصدير حسب الحالة", m.exportPackagesByStatus);
  rows.push(["إجمالي البرامج النشطة", "—", m.totalActivePrograms]);
  rows.push(["البرامج المنشورة", "—", m.publishedCount]);
  rows.push(["ملاحظات غير محلولة", "—", m.unresolvedFeedback]);
  rows.push(["أخطاء توافق حاجبة", "—", m.blockingChecks]);
  rows.push(["نشاط التدقيق (24 ساعة)", "—", m.auditLast24h]);

  return buildXlsx("المؤشرات", rows);
}
