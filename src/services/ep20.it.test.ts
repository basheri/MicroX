// @vitest-environment node
//
// EP-20 integration tests (real Postgres, gated on TEST_DATABASE_URL). Proves the
// dashboard metrics are real DB aggregations (counts by stage/approval), and that the
// Excel export builds a valid .xlsx containing those numbers.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { createProgram } from "@/services/programService";
import { publishProgram } from "@/services/versioningService";
import { getMetrics, exportMetricsXlsx } from "@/services/metricsService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-20 — dashboard metrics (integration)", () => {
  let db: IsolatedDb;

  beforeAll(async () => {
    db = await createIsolatedDb("ep20");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    // Three programs; publish one (advances is_published + a 'published' stage is not
    // required — publish just locks and snapshots).
    const p1 = (await createProgram({ name: "برنامج ١", sectorId, fieldId }, "منى")).id;
    await createProgram({ name: "برنامج ٢", sectorId, fieldId }, "منى");
    await createProgram({ name: "برنامج ٣", sectorId, fieldId }, "منى");
    await publishProgram(p1, "منى");
  });
  afterAll(async () => {
    await db?.teardown();
  });

  it("computes real counts by stage/approval and totals", async () => {
    const m = await getMetrics();
    expect(m.totalActivePrograms).toBe(3);
    expect(m.publishedCount).toBe(1);

    // Sum across the stage buckets equals the total (every program has a stage).
    const stageSum = m.programsByStage.reduce((s, b) => s + b.count, 0);
    expect(stageSum).toBe(3);

    const approvalSum = m.programsByApproval.reduce((s, b) => s + b.count, 0);
    expect(approvalSum).toBe(3);
    // Fresh programs default to 'not_approved'.
    expect(m.programsByApproval.find((b) => b.key === "not_approved")?.count).toBe(3);
  });

  it("exports a valid .xlsx that contains the metric numbers", async () => {
    const bytes = await exportMetricsXlsx();
    expect(bytes[0]).toBe(0x50); // PK zip
    const files = unzipSync(bytes);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("البرامج حسب المرحلة");
    expect(sheet).toContain("إجمالي البرامج النشطة");
    expect(sheet).toContain("<v>3</v>"); // total active programs
  });

  it("reflects a new program immediately (no stale/static values)", async () => {
    const before = (await getMetrics()).totalActivePrograms;
    const sectorId = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const fieldId = (await getPool().query("select id from fields limit 1")).rows[0].id;
    await createProgram({ name: "برنامج جديد", sectorId, fieldId }, "منى");
    expect((await getMetrics()).totalActivePrograms).toBe(before + 1);
  });
});
