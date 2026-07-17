-- Reverse of 0004 — remove seeded placeholder lookups.
delete from fields where name in ('المعلوماتية الصحية', 'الأمن السيبراني', 'إدارة المشاريع');
delete from sectors where name in ('الصحة', 'التقنية', 'الأعمال');
delete from development_paths where path_code in
  ('path_1', 'path_2', 'path_3', 'path_4', 'path_5', 'path_6');
