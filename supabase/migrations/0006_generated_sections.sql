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
