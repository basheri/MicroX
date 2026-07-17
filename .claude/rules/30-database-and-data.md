# 30 — Database & Data

Backed by `db/schema.sql`. Apply these conventions to any table you add.

## Conventions (every core table)
- `id uuid primary key default gen_random_uuid()`.
- Audit columns: `created_at`, `updated_at`, `created_by_actor`, `updated_by_actor`.
- Soft delete (deletable entities): `is_deleted boolean not null default false`, `deleted_at`, `deleted_by_actor`. Default queries exclude `is_deleted = true`.
- Log/append-only tables: keep `created_at` + actor; do not update or delete rows.

## RLS
- Enable Row Level Security on all tables. v1 policy = `USING (true)` (no per-user filtering — there is no login). Structure is ready to tighten later **without data migration**; do not assume user-scoped policies now.

## Versioning
- On every meaningful change, write a full **JSONB snapshot** of the program to `program_versions` with an incrementing `version_no` and the `trigger_event`.
- Published programs are locked (BR-020); restoring creates a NEW version, never overwrites history.

## Storage
- Files in a private Supabase bucket; serve via short-lived Signed URLs only.

## Search & indexes
- GIN indexes on Arabic `tsvector` for program name/description.
- B-Tree indexes on dashboard filters (sector, field, path, stage, approval) and on every FK.

## Backup
- Supabase PITR + a documented daily logical snapshot in `backup_metadata`. Targets: **RPO ≤ 24h, RTO ≤ 4h**. Test restore periodically.

## Migrations
- All schema changes via numbered, reversible Supabase migration files. Never hand-edit production.
