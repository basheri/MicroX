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
