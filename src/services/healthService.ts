// Health & monitoring (EP-24). Reports the liveness of critical dependencies and a few
// operational signals (job/export failures) so a monitor can alert. Read-only.

import { getPool } from "@/data/pool";

export interface HealthComponent {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface HealthReport {
  ok: boolean;
  components: HealthComponent[];
  signals: {
    failedGenerationJobs: number;
    failedExports: number;
    lowFidelityDocuments: number;
  };
}

async function checkDb(): Promise<HealthComponent> {
  try {
    await getPool().query("select 1");
    return { name: "database", ok: true };
  } catch (err) {
    return { name: "database", ok: false, detail: (err as Error).message };
  }
}

async function countSafe(sql: string): Promise<number> {
  try {
    const rows = await getPool().query<{ n: number }>(sql);
    return rows.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getHealth(): Promise<HealthReport> {
  const db = await checkDb();

  // Operational failure signals — alertable (generation/fill failures per rule EP-24).
  const [failedGenerationJobs, failedExports, lowFidelityDocuments] = db.ok
    ? await Promise.all([
        countSafe("select count(*)::int n from generation_jobs where status='failed'"),
        countSafe("select count(*)::int n from export_packages where status='failed'"),
        countSafe(
          "select count(*)::int n from generated_documents where fidelity_passed=false and is_deleted=false",
        ),
      ])
    : [0, 0, 0];

  const components: HealthComponent[] = [db];
  return {
    ok: components.every((c) => c.ok),
    components,
    signals: { failedGenerationJobs, failedExports, lowFidelityDocuments },
  };
}

// Record a backup/restore drill outcome in backup_metadata (append-only, rule 30).
export async function recordBackupEvent(input: {
  snapshotId: string;
  status: string;
  rpoTs?: Date | null;
}): Promise<void> {
  await getPool().query(
    "insert into backup_metadata (snapshot_id, status, rpo_ts) values ($1,$2,$3)",
    [input.snapshotId, input.status, input.rpoTs ?? null],
  );
}
