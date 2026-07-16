// Dashboard metrics data layer (EP-20). Every metric is a precise DB aggregation over
// authoritative tables — never a static or in-memory value. Counts exclude soft-deleted
// rows where applicable. Time-boxed metrics use the DATABASE clock (now()) documented as
// UTC, avoiding app-side Date ambiguity.

import { getPool } from "@/data/pool";

export interface CountBucket {
  key: string;
  count: number;
}

async function grouped(sql: string): Promise<CountBucket[]> {
  const rows = await getPool().query<{ key: string; count: number }>(sql);
  return rows.rows.map((r) => ({ key: r.key ?? "—", count: Number(r.count) }));
}

export interface DashboardMetrics {
  programsByStage: CountBucket[];
  programsByApproval: CountBucket[];
  publishedCount: number;
  totalActivePrograms: number;
  generationJobsByStatus: CountBucket[];
  unresolvedFeedback: number;
  exportPackagesByStatus: CountBucket[];
  blockingChecks: number;
  auditLast24h: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    programsByStage,
    programsByApproval,
    published,
    totalActive,
    generationJobsByStatus,
    unresolvedFeedback,
    exportPackagesByStatus,
    blockingChecks,
    auditLast24h,
  ] = await Promise.all([
    grouped(
      "select current_stage as key, count(*)::int as count from programs where is_deleted=false group by current_stage order by current_stage",
    ),
    grouped(
      "select approval_state as key, count(*)::int as count from programs where is_deleted=false group by approval_state order by approval_state",
    ),
    getPool().query<{ n: number }>(
      "select count(*)::int n from programs where is_deleted=false and is_published=true",
    ),
    getPool().query<{ n: number }>("select count(*)::int n from programs where is_deleted=false"),
    grouped(
      "select status as key, count(*)::int as count from generation_jobs group by status order by status",
    ),
    getPool().query<{ n: number }>(
      "select count(*)::int n from center_feedback_items where is_deleted=false and status <> 'resolved'",
    ),
    grouped(
      "select status as key, count(*)::int as count from export_packages where is_deleted=false group by status order by status",
    ),
    getPool().query<{ n: number }>(
      "select count(*)::int n from compliance_checks where severity='blocking' and status='fail'",
    ),
    getPool().query<{ n: number }>(
      "select count(*)::int n from audit_logs where occurred_at > now() - interval '24 hours'",
    ),
  ]);

  return {
    programsByStage,
    programsByApproval,
    publishedCount: published.rows[0]!.n,
    totalActivePrograms: totalActive.rows[0]!.n,
    generationJobsByStatus,
    unresolvedFeedback: unresolvedFeedback.rows[0]!.n,
    exportPackagesByStatus,
    blockingChecks: blockingChecks.rows[0]!.n,
    auditLast24h: auditLast24h.rows[0]!.n,
  };
}
