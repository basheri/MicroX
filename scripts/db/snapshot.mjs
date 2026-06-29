// Regenerates db/schema.sql as a single consolidated, human-readable reference by
// concatenating the up migrations in order. The migrations under supabase/migrations/
// are the SOURCE OF TRUTH (rule 30); db/schema.sql is generated — never hand-edit it.
//
// Usage: node scripts/db/snapshot.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const OUT = join(__dirname, "..", "..", "db", "schema.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const header = `-- =====================================================================
-- MicroX — consolidated database schema (GENERATED — DO NOT EDIT BY HAND)
-- Source of truth: supabase/migrations/*.sql. Regenerate with:
--   node scripts/db/snapshot.mjs
-- This file is a convenience reference (the 52-table schema + EP-02 objects).
-- =====================================================================

`;

const body = files
  .map(
    (f) =>
      `-- ====== supabase/migrations/${f} ======\n${readFileSync(join(MIGRATIONS_DIR, f), "utf8").trimEnd()}\n`,
  )
  .join("\n");

writeFileSync(OUT, header + body + "\n");
console.log(`wrote ${OUT} from ${files.length} migration(s): ${files.join(", ")}`);
