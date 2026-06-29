-- =====================================================================
-- 0003 — Private storage bucket (EP-02)
-- Rule 00 / SEC-007: files live in a PRIVATE Supabase Storage bucket, served
-- only via short-lived Signed URLs — no permanent public links.
-- Guarded so the migration also applies on a plain Postgres (no `storage` schema).
-- =====================================================================

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('program-files', 'program-files', false)
    on conflict (id) do update set public = excluded.public;
  else
    raise notice '0003: storage schema absent (non-Supabase env); bucket creation skipped';
  end if;
end $$;
