// @vitest-environment node
//
// EP-03 service integration tests (real Postgres, gated on TEST_DATABASE_URL).
// Proves: create (name+sector+field only), stage advance + status history, computed
// metrics, dashboard filters, and BR-001/BR-002 enforcement at the structure gate.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIsolatedDb, type IsolatedDb } from "@/test/itDb";
import { setPool, getPool } from "@/data/pool";
import { getStatusHistory } from "@/data/programsRepo";
import {
  createProgram,
  advanceStage,
  setStage,
  recomputeMetrics,
  listPrograms,
  ProgramRuleError,
} from "@/services/programService";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-03 — program & stage management (integration)", () => {
  let db: IsolatedDb;
  let sectorId: string;
  let fieldId: string;
  let otherSectorId: string;

  beforeAll(async () => {
    db = await createIsolatedDb("ep03");
    process.env.DATABASE_URL = db.url;
    setPool(db.pool);
    const sectors = await getPool().query("select id, name from sectors order by name");
    sectorId = sectors.rows[0].id;
    otherSectorId = sectors.rows[1].id;
    const fields = await getPool().query("select id from fields where sector_id = $1", [sectorId]);
    fieldId = fields.rows[0].id;
  });

  afterAll(async () => {
    await db?.teardown();
  });

  it("creates a program from name+sector+field and records the initial stage history", async () => {
    const p = await createProgram({ name: "برنامج الأمن", sectorId, fieldId }, "منى");
    expect(p.current_stage).toBe("new");
    expect(p.completion_pct).toBe(0);

    const history = await getStatusHistory(p.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.stage).toBe("new");
    expect(history[0]!.changed_by_actor).toBe("منى");
  });

  it("advances stages, recording history and updating completion_pct", async () => {
    const p = await createProgram({ name: "برنامج التحليلات", sectorId, fieldId }, "سارة");
    const afterOne = await advanceStage(p.id, "سارة"); // new -> sources
    expect(afterOne.current_stage).toBe("sources");
    const afterTwo = await advanceStage(p.id, "سارة"); // sources -> market
    expect(afterTwo.current_stage).toBe("market");
    expect(afterTwo.completion_pct).toBeGreaterThan(0);

    const history = await getStatusHistory(p.id);
    expect(history.map((h) => h.stage)).toEqual(["new", "sources", "market"]);
  });

  it("recomputes metrics: an empty program has BR-001 + BR-002 blocking errors", async () => {
    const p = await createProgram({ name: "برنامج فارغ", sectorId, fieldId }, "منى");
    const metrics = await recomputeMetrics(p.id);
    expect(metrics.blockingErrors).toBe(2);
    expect(metrics.issues.map((i) => i.ruleCode).sort()).toEqual(["BR-001", "BR-002"]);
  });

  it("BLOCKS reaching the export gate while BR-001/BR-002 are violated (service-layer enforcement)", async () => {
    const p = await createProgram({ name: "برنامج بلا مقررات", sectorId, fieldId }, "منى");
    await expect(setStage(p.id, "compliance", "منى")).rejects.toBeInstanceOf(ProgramRuleError);
    try {
      await setStage(p.id, "export", "منى");
    } catch (err) {
      expect((err as ProgramRuleError).issues.map((i) => i.ruleCode)).toContain("BR-001");
    }
    // It must NOT have advanced.
    const still = (await listPrograms()).find((x) => x.id === p.id)!;
    expect(["new"]).toContain(still.current_stage);
  });

  it("ALLOWS the export gate once the structure is valid (2..6 courses, 3..23 credits)", async () => {
    const p = await createProgram({ name: "برنامج مكتمل", sectorId, fieldId }, "منى");
    // Add a valid structure directly: 2 courses, 3+3=6 total credits (within BR-001/BR-002).
    for (const credits of [3, 3]) {
      await getPool().query(
        `insert into courses (program_id, title, credit_hours, actual_hours)
         values ($1, 'مقرر', $2, $3)`,
        [p.id, credits, credits * 15],
      );
    }
    const metrics = await recomputeMetrics(p.id);
    expect(metrics.blockingErrors).toBe(0);

    const moved = await setStage(p.id, "compliance", "منى");
    expect(moved.current_stage).toBe("compliance");
  });

  it("filters the dashboard list by sector, stage, approval and search", async () => {
    const a = await createProgram({ name: "برنامج قابل للبحث ألفا", sectorId, fieldId }, "منى");
    // A program in a different sector should be excluded by the sector filter.
    const otherField = await getPool().query("select id from fields where sector_id = $1", [
      otherSectorId,
    ]);
    await createProgram(
      { name: "برنامج قطاع آخر", sectorId: otherSectorId, fieldId: otherField.rows[0].id },
      "منى",
    );

    const bySector = await listPrograms({ sectorId });
    expect(bySector.every((x) => x.sector_id === sectorId)).toBe(true);
    expect(bySector.some((x) => x.id === a.id)).toBe(true);

    const byStage = await listPrograms({ stage: "new" });
    expect(byStage.every((x) => x.current_stage === "new")).toBe(true);

    const byApproval = await listPrograms({ approvalState: "not_approved" });
    expect(byApproval.length).toBeGreaterThan(0);

    const bySearch = await listPrograms({ search: "ألفا" });
    expect(bySearch.some((x) => x.id === a.id)).toBe(true);
    expect(bySearch.every((x) => x.name.includes("ألفا"))).toBe(true);
  });

  it("refuses an anonymous stage change (rule 00)", async () => {
    const p = await createProgram({ name: "بدون فاعل", sectorId, fieldId }, "منى");
    await expect(advanceStage(p.id, "")).rejects.toThrow(/actor_name is required/);
  });
});
