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
