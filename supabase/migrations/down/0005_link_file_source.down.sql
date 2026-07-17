-- Reverse of 0005 — drop the file -> source link.
drop index if exists idx_files_source;
alter table uploaded_files drop column if exists source_id;
