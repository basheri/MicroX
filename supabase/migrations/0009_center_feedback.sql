-- =====================================================================
-- 0009 — Center feedback (EP-18). Reviewer feedback → items → change proposals →
-- preview-before-apply. Refines the thin 0001 tables with actor attribution, soft
-- delete, categories, and version linkage so that applying a proposal creates a
-- program version (D-06) and is fully auditable. A proposal is the PREVIEW (before/
-- after); nothing mutates until it is explicitly applied after approval.
-- =====================================================================

-- center_feedback_items: attribution, category, soft delete, updated_at.
alter table center_feedback_items
  add column category text,
  add column created_by_actor text,
  add column updated_at timestamptz not null default now(),
  add column is_deleted boolean not null default false,
  add column deleted_at timestamptz,
  add column deleted_by_actor text;

-- change_proposals: default decision, attribution, decision metadata, and the version
-- created when the proposal is applied.
alter table change_proposals
  alter column decision set default 'pending',
  add column section_ref text,
  add column created_by_actor text,
  add column decided_by_actor text,
  add column decided_at timestamptz,
  add column applied_version_no int;

create index if not exists idx_feedback_items_file on center_feedback_items(feedback_file_id);
create index if not exists idx_proposals_program on change_proposals(program_id);
create index if not exists idx_proposals_item on change_proposals(feedback_item_id);
