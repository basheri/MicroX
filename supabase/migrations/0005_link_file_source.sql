-- =====================================================================
-- 0005 — Schema refinement (EP-08): link uploaded_files to its program_sources row
-- so a file's trust class (source_type) is EXPLICIT, not defaulted at RAG time
-- (AI-003). Nullable for backward compatibility with any pre-existing files.
-- =====================================================================

alter table uploaded_files
  add column source_id uuid references program_sources(id);

create index idx_files_source on uploaded_files(source_id);
