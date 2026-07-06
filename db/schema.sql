-- =====================================================================
-- MicroX — consolidated database schema (GENERATED — DO NOT EDIT BY HAND)
-- Source of truth: supabase/migrations/*.sql. Regenerate with:
--   node scripts/db/snapshot.mjs
-- This file is a convenience reference (the 52-table schema + EP-02 objects).
-- =====================================================================

-- ====== supabase/migrations/0001_init_schema.sql ======
-- =====================================================================
-- MicroX — PostgreSQL / Supabase schema (52 tables)
-- Conventions: uuid PK (gen_random_uuid); audit columns; soft delete on
-- deletable entities; JSONB version snapshots; CHECK constraints back the
-- numeric business rules; RLS enabled with permissive v1 policy (no login).
-- NOTE: table "references" (the spec name) is a reserved word -> named
--       program_references here.
-- Fields/paths exact values await the official template/guide (V-01..V-03).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- 1. Lookups -------------------------------------------------
create table sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table fields (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references sectors(id),
  name text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sector_id, name)
);
create index idx_fields_sector on fields(sector_id);

create table development_paths (   -- exactly 6 seed rows; see V-02
  id uuid primary key default gen_random_uuid(),
  path_code text not null unique,
  name text not null,
  default_duration text,
  description text
);

-- ---------- 2. Program root -------------------------------------------
create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector_id uuid not null references sectors(id),
  field_id  uuid not null references fields(id),
  development_path_id uuid references development_paths(id),
  current_stage text not null default 'new'
    check (current_stage in ('new','sources','market','feasibility','structure',
      'outcomes','courses','content','hours','questions','references','review',
      'compliance','export')),
  sub_status text not null default 'new',
  completion_pct int not null default 0 check (completion_pct between 0 and 100),
  blocking_errors int not null default 0,
  warnings_count int not null default 0,
  approval_state text not null default 'not_approved'
    check (approval_state in ('not_approved','submitted','approved','returned')),
  template_version_id uuid,                  -- FK added at end (avoids cycle)
  current_version_no int not null default 1,
  is_published boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by_actor text,
  created_by_actor text,
  updated_by_actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_programs_filters on programs(sector_id, field_id, development_path_id, current_stage, approval_state);
create index idx_programs_name_fts on programs using gin (to_tsvector('simple', coalesce(name,'')));

-- ---------- 3. Program lifecycle --------------------------------------
create table program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  version_no int not null,
  snapshot jsonb not null,
  trigger_event text not null,
  created_by_actor text,
  created_at timestamptz not null default now(),
  unique (program_id, version_no)
);
create index idx_versions_program on program_versions(program_id);

create table program_status_history (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  stage text not null,
  sub_status text,
  changed_by_actor text,
  changed_at timestamptz not null default now()
);
create index idx_status_hist_program on program_status_history(program_id, changed_at);

create table program_sources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  source_type text not null check (source_type in ('from_center','from_university','align_existing','professional_sector')),
  notes text,
  is_deleted boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);

-- ---------- 4. Files & extraction -------------------------------------
create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id),
  storage_path text not null,
  original_name text not null,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes bigint not null,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','infected')),
  is_deleted boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);
create index idx_files_program on uploaded_files(program_id);

create table extracted_file_content (
  id uuid primary key default gen_random_uuid(),
  uploaded_file_id uuid not null references uploaded_files(id),
  page_no int,
  bbox text,
  content text,
  source_class text,
  confidence numeric check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index idx_extract_file on extracted_file_content(uploaded_file_id);

create table extraction_reviews (
  id uuid primary key default gen_random_uuid(),
  extracted_content_id uuid not null references extracted_file_content(id),
  status text not null check (status in ('approved','corrected','rejected')),
  corrected_content text,
  reviewed_by_actor text,
  created_at timestamptz not null default now()
);

create table redaction_logs (
  id uuid primary key default gen_random_uuid(),
  uploaded_file_id uuid references uploaded_files(id),
  entity_type text not null check (entity_type in ('name','national_id','email','phone')),
  count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 5. Market & feasibility -----------------------------------
create table market_analysis (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  summary text,
  feasibility_rating text check (feasibility_rating in ('high','medium','low','insufficient_evidence')),
  is_approved boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);
create index idx_market_program on market_analysis(program_id);

create table market_skills (
  id uuid primary key default gen_random_uuid(),
  market_analysis_id uuid not null references market_analysis(id) on delete cascade,
  skill text not null,
  demand_level text
);

create table market_sources (
  id uuid primary key default gen_random_uuid(),
  market_analysis_id uuid not null references market_analysis(id) on delete cascade,
  url text,
  title text,
  reliability text
);

create table feasibility_assessments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  rating text not null check (rating in ('high','medium','low','insufficient_evidence')),
  justification text,             -- required when rating weak (enforced in service layer)
  created_by_actor text,
  created_at timestamptz not null default now()
);

create table competencies (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  statement text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 6. Academic structure -------------------------------------
create table program_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  statement text not null,
  bloom_verb text,
  measurable boolean not null default true,
  order_index int,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_plo_program on program_learning_outcomes(program_id);

create table courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  title text not null,
  credit_hours numeric not null check (credit_hours between 1 and 10),      -- BR-003
  actual_hours numeric not null,                                            -- = credit_hours*15 (BR-006, enforced in service+test)
  order_index int,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_courses_program on courses(program_id);
-- Program-level limits BR-001 (2..6 courses) and BR-002 (3..23 total credits)
-- are enforced in the service layer + CI tests (cannot be a single-row CHECK).

create table course_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  statement text not null,
  measurable boolean not null default true,
  order_index int,
  is_deleted boolean not null default false
);
create index idx_clo_course on course_learning_outcomes(course_id);

create table course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  title text not null,
  order_index int,
  is_deleted boolean not null default false
);
create index idx_units_course on course_units(course_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references course_units(id),
  title text not null,
  objective text,
  duration_minutes int,
  order_index int,
  is_deleted boolean not null default false
);
create index idx_lessons_unit on lessons(unit_id);

create table learning_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id),
  resource_type text,
  title text,
  duration_minutes int,
  is_deleted boolean not null default false
);

create table learning_activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id),
  title text,
  is_formative boolean not null default true,    -- BR-009: never counted toward passing
  is_deleted boolean not null default false
);

create table instructional_design_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id),
  resource_id uuid references learning_resources(id),
  asset_type text check (asset_type in ('video_script','audio_script','visual_brief','other')),
  content text,
  created_at timestamptz not null default now()
);

create table hour_allocations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  unit_id uuid references course_units(id),
  hours numeric not null,
  category text
);
create index idx_hours_course on hour_allocations(course_id);

create table program_schedules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  total_credit numeric,
  total_actual numeric,
  weeks int,
  weekly_load numeric check (weekly_load <= 15),   -- BR-005
  created_at timestamptz not null default now()
);

-- ---------- 7. Questions & references ---------------------------------
create table question_banks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  title text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references question_banks(id),
  clo_id uuid references course_learning_outcomes(id),   -- every question links to an outcome (quality)
  course_id uuid references courses(id),
  unit_id uuid references course_units(id),
  stem text not null,
  qtype text not null,
  correct_answer text,
  explanation text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  topic text,
  source_ref text,
  review_status text not null default 'draft',
  is_deleted boolean not null default false
);
create index idx_questions_bank on questions(question_bank_id);
create index idx_questions_clo on questions(clo_id);

create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id),
  option_text text not null,
  is_correct boolean not null default false
);
create index idx_options_question on question_options(question_id);

create table program_references (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  citation text not null,
  language text check (language in ('ar','en')),
  ref_type text,
  verified boolean not null default false,
  verification_note text,
  is_deleted boolean not null default false
);
create index idx_refs_program on program_references(program_id);

-- ---------- 8. Alignment ----------------------------------------------
create table alignment_matrix (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  competency_id uuid references competencies(id),
  plo_id uuid references program_learning_outcomes(id),
  clo_id uuid references course_learning_outcomes(id),
  unit_id uuid references course_units(id),
  question_id uuid references questions(id),
  created_at timestamptz not null default now()
);
create index idx_align_program on alignment_matrix(program_id);

-- ---------- 9. Templates & generated docs -----------------------------
create table official_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  doc_type text not null check (doc_type in ('program_card','program_document','course_descriptor','other')),
  created_at timestamptz not null default now()
);

create table template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references official_templates(id),
  version_no int not null,
  storage_path text not null,
  approved boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

create table template_fields (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references template_versions(id),
  field_key text not null,
  control_type text,            -- content_control | bookmark | table (see V-06)
  is_required boolean not null default false
);
create index idx_tfields_version on template_fields(template_version_id);

create table template_mappings (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references template_versions(id),
  field_key text not null,
  db_source text not null        -- table.column or section reference
);

create table generated_documents (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  template_version_id uuid not null references template_versions(id),
  doc_type text not null,
  storage_path text,
  fidelity_passed boolean not null default false,
  is_deleted boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);

-- ---------- 10. Quality & governance ----------------------------------
create table compliance_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  description text,
  severity text not null check (severity in ('blocking','warning','suggestion')),
  is_active boolean not null default true
);

create table compliance_checks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  rule_id uuid references compliance_rules(id),
  severity text not null check (severity in ('blocking','warning','suggestion')),
  location text,
  suggested_fix text,
  created_at timestamptz not null default now()
);
create index idx_checks_program on compliance_checks(program_id);

create table quality_assessments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  axis text not null,
  score numeric check (score between 0 and 100),
  notes text,
  created_at timestamptz not null default now()
);

create table review_comments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  section_ref text,
  comment text,
  status text not null default 'open',
  is_deleted boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);

create table center_feedback_files (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  storage_path text,
  created_by_actor text,
  created_at timestamptz not null default now()
);

create table center_feedback_items (
  id uuid primary key default gen_random_uuid(),
  feedback_file_id uuid not null references center_feedback_files(id),
  section_ref text,
  item_text text,
  status text not null default 'new' check (status in ('new','in_progress','resolved','needs_clarification')),
  created_at timestamptz not null default now()
);

create table change_proposals (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  feedback_item_id uuid references center_feedback_items(id),
  old_text text,
  new_text text,
  reason text,
  decision text check (decision in ('pending','applied','rejected')),
  created_at timestamptz not null default now()
);

create table approvals_status (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  approver_body text,
  approved_version int,
  proof_path text,
  recorded_at timestamptz not null default now()
);

create table export_packages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  status text not null default 'building' check (status in ('building','ready','failed')),
  storage_path text,
  index_manifest jsonb,
  justification text,            -- required if exported with low quality (BR-019)
  is_deleted boolean not null default false,
  created_by_actor text,
  created_at timestamptz not null default now()
);

-- ---------- 11. System --------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_name text not null,
  occurred_at timestamptz not null default now(),
  operation_type text not null,
  program_id uuid references programs(id),
  section_ref text,
  old_value jsonb,
  new_value jsonb,
  change_reason text,
  override_justification text,
  llm_model text,
  operation_status text,
  version_no int,
  request_id uuid
);
create index idx_audit_program on audit_logs(program_id, occurred_at);

create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  progress int not null default 0 check (progress between 0 and 100),
  sections jsonb,
  created_by_actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_jobs_program on generation_jobs(program_id);

create table llm_requests (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id),
  generation_job_id uuid references generation_jobs(id),
  model text,
  tokens_in int,
  tokens_out int,
  cost numeric,
  status text,
  created_at timestamptz not null default now()
);

create table deleted_items (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  snapshot jsonb not null,
  deleted_by_actor text,
  deleted_at timestamptz not null default now()
);

create table application_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb,
  updated_by_actor text,
  updated_at timestamptz not null default now()
);

create table llm_settings (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  encrypted_api_key text,          -- encrypted server-side; never returned in full
  last_tested_at timestamptz,
  updated_by_actor text,
  updated_at timestamptz not null default now()
);

create table backup_metadata (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text,
  rpo_ts timestamptz,
  status text,
  created_at timestamptz not null default now()
);

-- ---------- Deferred FK (programs -> template_versions) ----------------
alter table programs
  add constraint fk_programs_template_version
  foreign key (template_version_id) references template_versions(id);

-- ---------- RLS: enable + permissive v1 policy (no login) --------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', t.tablename);
    execute format(
      'create policy %I on public.%I for all using (true) with check (true);',
      'p_all_' || t.tablename, t.tablename);
  end loop;
end $$;

-- ====== supabase/migrations/0002_soft_delete_and_restore.sql ======
-- =====================================================================
-- 0002 — Soft-delete convenience views + deleted_items restore path (EP-02)
-- Rule 30-database-and-data: default queries exclude is_deleted = true;
-- soft delete keeps a restorable copy in deleted_items.
-- =====================================================================

create schema if not exists app;

-- One `active_<table>` view per soft-deletable table (those with is_deleted),
-- exposing only non-deleted rows. Built dynamically so it tracks the schema.
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'is_deleted'
    order by table_name
  loop
    execute format(
      'create or replace view public.active_%I as select * from public.%I where is_deleted = false;',
      t, t);
  end loop;
end $$;

-- Soft-delete a row: flip is_deleted (+ deleted_at/deleted_by_actor when present)
-- and store a full JSONB snapshot in deleted_items so it can be restored.
create or replace function app.soft_delete(p_table text, p_id uuid, p_actor text)
returns uuid
language plpgsql
as $$
declare
  v_has_del   boolean;
  v_has_delat boolean;
  v_has_delby boolean;
  v_snapshot  jsonb;
  v_sql       text;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'soft_delete: actor is required (rule 00 — no anonymous writes)';
  end if;

  select
    bool_or(column_name = 'is_deleted'),
    bool_or(column_name = 'deleted_at'),
    bool_or(column_name = 'deleted_by_actor')
  into v_has_del, v_has_delat, v_has_delby
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table;

  if v_has_del is distinct from true then
    raise exception 'soft_delete: table % is not soft-deletable (no is_deleted column)', p_table;
  end if;

  execute format('select to_jsonb(t) from public.%I t where id = %L', p_table, p_id)
    into v_snapshot;
  if v_snapshot is null then
    raise exception 'soft_delete: % with id % not found', p_table, p_id;
  end if;

  v_sql := format('update public.%I set is_deleted = true', p_table);
  if v_has_delat then v_sql := v_sql || ', deleted_at = now()'; end if;
  if v_has_delby then v_sql := v_sql || format(', deleted_by_actor = %L', p_actor); end if;
  v_sql := v_sql || format(' where id = %L', p_id);
  execute v_sql;

  insert into public.deleted_items (entity_table, entity_id, snapshot, deleted_by_actor)
  values (p_table, p_id, v_snapshot, p_actor);

  return p_id;
end;
$$;

-- Restore a previously soft-deleted row: clear is_deleted on the original row and
-- consume the deleted_items entry. (Program version semantics — restore-as-new-version,
-- BR-020 — are layered on in EP-19; here we just un-delete the row.)
create or replace function app.restore(p_deleted_item_id uuid, p_actor text)
returns uuid
language plpgsql
as $$
declare
  v_table     text;
  v_entity    uuid;
  v_has_delat boolean;
  v_has_delby boolean;
  v_sql       text;
  v_count     int;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'restore: actor is required (rule 00 — no anonymous writes)';
  end if;

  select entity_table, entity_id into v_table, v_entity
  from public.deleted_items where id = p_deleted_item_id;
  if not found then
    raise exception 'restore: deleted_item % not found', p_deleted_item_id;
  end if;

  select
    bool_or(column_name = 'deleted_at'),
    bool_or(column_name = 'deleted_by_actor')
  into v_has_delat, v_has_delby
  from information_schema.columns
  where table_schema = 'public' and table_name = v_table;

  v_sql := format('update public.%I set is_deleted = false', v_table);
  if v_has_delat then v_sql := v_sql || ', deleted_at = null'; end if;
  if v_has_delby then v_sql := v_sql || ', deleted_by_actor = null'; end if;
  v_sql := v_sql || format(' where id = %L', v_entity);
  execute v_sql;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'restore: original row %.% no longer exists', v_table, v_entity;
  end if;

  delete from public.deleted_items where id = p_deleted_item_id;
  return v_entity;
end;
$$;

-- ====== supabase/migrations/0003_storage_bucket.sql ======
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

-- ====== supabase/migrations/0004_seed_lookups.sql ======
-- =====================================================================
-- 0004 — Seed lookups (EP-02)
-- development_paths: EXACTLY 6 rows are required (BR-012), but their official
-- names / durations / eligibility are UNKNOWN until the NELC guide is provided.
-- ==> V-02. We seed 6 clearly-marked PLACEHOLDERS and never guess the real names.
-- sectors / fields: generic starter examples only; fully editable by users
-- (soft-deletable). They carry no academic meaning and are not template fields.
-- =====================================================================

-- --- development_paths: 6 placeholders (BR-012 count known; names pending V-02) ---
insert into development_paths (path_code, name, default_duration, description)
values
  ('path_1', 'مسار التطوير 1 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — official name/duration/eligibility pending the NELC guide (V-02). Do not treat as final.'),
  ('path_2', 'مسار التطوير 2 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — pending V-02.'),
  ('path_3', 'مسار التطوير 3 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — pending V-02.'),
  ('path_4', 'مسار التطوير 4 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — pending V-02.'),
  ('path_5', 'مسار التطوير 5 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — pending V-02.'),
  ('path_6', 'مسار التطوير 6 (بانتظار الاسم الرسمي — V-02)', null,
   'PLACEHOLDER — pending V-02.')
on conflict (path_code) do nothing;

-- --- sectors / fields: generic, editable starter examples (not from any official source) ---
insert into sectors (name) values ('الصحة'), ('التقنية'), ('الأعمال')
on conflict (name) do nothing;

insert into fields (sector_id, name)
select s.id, f.name
from (values
  ('الصحة',  'المعلوماتية الصحية'),
  ('التقنية', 'الأمن السيبراني'),
  ('الأعمال', 'إدارة المشاريع')
) as f(sector_name, name)
join sectors s on s.name = f.sector_name
on conflict (sector_id, name) do nothing;

-- ====== supabase/migrations/0005_link_file_source.sql ======
-- =====================================================================
-- 0005 — Schema refinement (EP-08): link uploaded_files to its program_sources row
-- so a file's trust class (source_type) is EXPLICIT, not defaulted at RAG time
-- (AI-003). Nullable for backward compatibility with any pre-existing files.
-- =====================================================================

alter table uploaded_files
  add column source_id uuid references program_sources(id);

create index idx_files_source on uploaded_files(source_id);

-- ====== supabase/migrations/0006_generated_sections.sql ======
-- =====================================================================
-- 0006 — Generation staging (EP-09). Infrastructure table (NOT a domain/template
-- field) backing the preview-before-apply workflow, section pinning, and impact
-- analysis: generated content lands here as a PREVIEW and only becomes 'applied' via
-- an explicit human apply step (AI-006 / D-03). One current section per program/key.
-- =====================================================================

create table generated_sections (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  generation_job_id uuid references generation_jobs(id),
  section_key text not null,
  content jsonb not null,
  status text not null default 'previewed'
    check (status in ('previewed', 'applied', 'discarded')),
  is_pinned boolean not null default false,
  created_by_actor text,
  applied_by_actor text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, section_key)
);
create index idx_gensections_program on generated_sections(program_id);
create index idx_gensections_job on generated_sections(generation_job_id);

-- RLS (rule 30): enable + permissive v1 policy (this table did not exist when 0001 ran).
alter table generated_sections enable row level security;
create policy p_all_generated_sections on generated_sections for all using (true) with check (true);

-- ====== supabase/migrations/0007_compliance_engine.sql ======
-- =====================================================================
-- 0007 — Compliance engine (EP-16 / D-08 / BR-019). Turns the two thin
-- compliance tables from 0001 into a DATA-DRIVEN rules engine: rules are rows
-- in `compliance_rules` (editable in the DB, no rebuild), each carrying a
-- `rule_type` the engine knows how to evaluate plus a `fact_key` + `params`.
-- Evaluation writes classified `compliance_checks` (blocking/warning/suggestion,
-- status pass/fail). The export gate (BR-019) reads these.
--
-- V-05 (the OFFICIAL list of mandatory fields that block export) is unknown until
-- the NELC guide arrives: rows seeded from placeholder config carry
-- `is_placeholder = true` and the real values drop into src/config/complianceConfig
-- with no schema change.
-- =====================================================================

-- ---- compliance_rules: make it an evaluable, editable rule set ----
alter table compliance_rules
  add column rule_type text not null default 'numeric_min_max'
    check (rule_type in ('numeric_min_max', 'numeric_min', 'numeric_max', 'required_present')),
  add column fact_key text,                    -- which program fact the rule reads
  add column params jsonb not null default '{}'::jsonb,  -- thresholds (min/max)
  add column message text,                     -- Arabic, user-facing (rule 50)
  add column category text,                    -- grouping for reports (structure/field/quality)
  add column is_placeholder boolean not null default false;  -- V-05 not yet finalized

-- ---- compliance_checks: record each rule's outcome for a program ----
alter table compliance_checks
  add column rule_code text,                   -- snapshot (survives rule edits/deletes)
  add column status text not null default 'fail'
    check (status in ('pass', 'fail')),
  add column message text,
  add column observed_value text,              -- the fact value seen at evaluation
  add column run_id uuid;                      -- groups one evaluation pass

-- Rules are EDITABLE, including hard-deletable (D-08). A check snapshots `rule_code`,
-- so deleting a rule must NOT be blocked by historical checks — null the link and keep
-- the audit record. (0001 created the FK with the default RESTRICT behaviour.)
alter table compliance_checks drop constraint if exists compliance_checks_rule_id_fkey;
alter table compliance_checks
  add constraint compliance_checks_rule_id_fkey
  foreign key (rule_id) references compliance_rules(id) on delete set null;

create index if not exists idx_checks_run on compliance_checks(run_id);
create index if not exists idx_rules_active on compliance_rules(is_active);

