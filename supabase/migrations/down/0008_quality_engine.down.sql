-- Reverse of 0008 — drop the quality-engine columns/indexes.
drop index if exists idx_quality_program;
drop index if exists idx_quality_run;

alter table quality_assessments
  drop column if exists run_id,
  drop column if exists axis_label,
  drop column if exists kind,
  drop column if exists weight,
  drop column if exists confidence,
  drop column if exists is_warning,
  drop column if exists evidence,
  drop column if exists created_by_actor;
