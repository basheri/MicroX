// @vitest-environment node
//
// EP-24 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the
// operational surface: the health report reflects DB liveness + failure signals, and
// a backup/restore event is recorded to backup_metadata (append-only).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { getHealth, recordBackupEvent } from "@/services/healthService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-24 — operations (integration)", () => {
  let db: IsolatedDb;

  beforeAll(async () => {
    db = await createIsolatedDb("ep24");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("reports healthy DB + zero failure signals on a clean database", async () => {
    const h = await getHealth();
    expect(h.ok).toBe(true);
    expect(h.components.find((c) => c.name === "database")?.ok).toBe(true);
    expect(h.signals.failedGenerationJobs).toBe(0);
    expect(h.signals.failedExports).toBe(0);
    expect(h.signals.lowFidelityDocuments).toBe(0);
  });

  it("surfaces a failed export as an alertable signal", async () => {
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    const programId = (
      await getPool().query(
        "insert into programs (name, sector_id, field_id, current_stage, sub_status) values ('برنامج',$1,$2,'new','new') returning id",
        [sectorId, fieldId],
      )
    ).rows[0].id;
    await getPool().query("insert into export_packages (program_id, status) values ($1,'failed')", [
      programId,
    ]);
    const h = await getHealth();
    expect(h.signals.failedExports).toBeGreaterThanOrEqual(1);
  });

  it("records a backup/restore drill event to backup_metadata (append-only)", async () => {
    await recordBackupEvent({ snapshotId: "drill-1", status: "restore_verified" });
    const rows = await getPool().query(
      "select status from backup_metadata where snapshot_id='drill-1'",
    );
    expect(rows.rows[0].status).toBe("restore_verified");
  });
});
