// @vitest-environment node
//
// EP-02 database integration tests (run against a REAL Postgres — Supabase is Postgres).
// Gated on TEST_DATABASE_URL so the default unit run needs no database; CI sets it.
// Proves the DoD: migrations run clean; RLS on; CRUD on programs with audit + soft delete.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
// Migration runner is shared with the CLI/CI (scripts/db/migrate.mjs).
import { applyAll } from "../../scripts/db/migrate.mjs";
import { setPool, getPool } from "@/data/pool";
import {
  createProgram,
  getActiveProgram,
  listActivePrograms,
  softDeleteProgram,
  restoreProgram,
} from "@/data/programsRepo";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("EP-02 — database & storage (integration)", () => {
  let admin: pg.Client;
  let pool: pg.Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    admin = new pg.Client({ connectionString: url });
    await admin.connect();
    // Fresh schema, then apply every migration in order — this IS the "migrations run clean" check.
    await applyAll(admin, { reset: true });
    pool = new pg.Pool({ connectionString: url });
    setPool(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.end();
  });

  it("applies the full schema: 52 tables", async () => {
    const { rows } = await admin.query(
      `select count(*)::int as n from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE' and table_name <> 'schema_migrations'`,
    );
    expect(rows[0].n).toBe(52);
  });

  it("enables RLS on every public table (USING true policy)", async () => {
    const { rows: noRls } = await admin.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false
         and c.relname <> 'schema_migrations'`,
    );
    expect(noRls.map((r) => r.relname)).toEqual([]);

    const { rows: pol } = await admin.query(
      `select count(*)::int as n from pg_policies where schemaname='public' and tablename='programs'`,
    );
    expect(pol[0].n).toBeGreaterThanOrEqual(1);
  });

  it("seeds exactly 6 development_paths as flagged V-02 placeholders (never guessed)", async () => {
    const { rows } = await admin.query(
      "select path_code, name, description from development_paths order by path_code",
    );
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.path_code)).toEqual([
      "path_1",
      "path_2",
      "path_3",
      "path_4",
      "path_5",
      "path_6",
    ]);
    // Every row is explicitly a placeholder tied to V-02 — no real path names invented.
    for (const r of rows) {
      expect(`${r.name} ${r.description}`).toMatch(/V-02|PLACEHOLDER/);
    }
  });

  it("provides soft-delete views and the restore helpers", async () => {
    const { rows: views } = await admin.query(
      `select count(*)::int as n from information_schema.views
       where table_schema='public' and table_name like 'active\\_%'`,
    );
    expect(views[0].n).toBeGreaterThan(0);
    expect(
      (await admin.query("select to_regprocedure('app.soft_delete(text,uuid,text)') r")).rows[0].r,
    ).toBeTruthy();
    expect(
      (await admin.query("select to_regprocedure('app.restore(uuid,text)') r")).rows[0].r,
    ).toBeTruthy();
  });

  it("CRUD on programs is attributed + audited, with soft delete and restore", async () => {
    const sector = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const field = (await getPool().query("select id from fields limit 1")).rows[0].id;

    // CREATE
    const program = await createProgram(
      { name: "برنامج اختبار التكامل", sectorId: sector, fieldId: field },
      "منى",
    );
    expect(program.id).toBeTruthy();
    expect(program.created_by_actor).toBe("منى");
    expect(await getActiveProgram(program.id)).not.toBeNull();

    const createAudit = await getPool().query(
      "select * from audit_logs where program_id=$1 and operation_type='program.create'",
      [program.id],
    );
    expect(createAudit.rows[0].actor_name).toBe("منى");
    expect(createAudit.rows[0].operation_status).toBe("success");

    // SOFT DELETE
    await softDeleteProgram(program.id, "منى");
    expect(await getActiveProgram(program.id)).toBeNull();
    const di = await getPool().query("select id from deleted_items where entity_id=$1", [
      program.id,
    ]);
    expect(di.rows).toHaveLength(1);

    // RESTORE
    const restoredId = await restoreProgram(di.rows[0].id, "سارة");
    expect(restoredId).toBe(program.id);
    expect(await getActiveProgram(program.id)).not.toBeNull();
    expect(
      (
        await getPool().query("select count(*)::int n from deleted_items where entity_id=$1", [
          program.id,
        ])
      ).rows[0].n,
    ).toBe(0);

    expect((await listActivePrograms()).some((p) => p.id === program.id)).toBe(true);
  });

  it("refuses an anonymous create (no actor — rule 00)", async () => {
    const sector = (await getPool().query("select id from sectors limit 1")).rows[0].id;
    const field = (await getPool().query("select id from fields limit 1")).rows[0].id;
    await expect(
      createProgram({ name: "بدون فاعل", sectorId: sector, fieldId: field }, ""),
    ).rejects.toThrow(/actor_name is required/);
  });
});
