-- Reverse of 0009 — drop the center-feedback refinement columns/indexes.
drop index if exists idx_proposals_item;
drop index if exists idx_proposals_program;
drop index if exists idx_feedback_items_file;

alter table change_proposals
  alter column decision drop default,
  drop column if exists section_ref,
  drop column if exists created_by_actor,
  drop column if exists decided_by_actor,
  drop column if exists decided_at,
  drop column if exists applied_version_no;

alter table center_feedback_items
  drop column if exists category,
  drop column if exists created_by_actor,
  drop column if exists updated_at,
  drop column if exists is_deleted,
  drop column if exists deleted_at,
  drop column if exists deleted_by_actor;
