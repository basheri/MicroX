-- Reverse of 0007 — drop the compliance-engine columns/indexes, restoring the
-- thin 0001 shape.
drop index if exists idx_rules_active;
drop index if exists idx_checks_run;

-- Restore the original RESTRICT foreign key from 0001.
alter table compliance_checks drop constraint if exists compliance_checks_rule_id_fkey;
alter table compliance_checks
  add constraint compliance_checks_rule_id_fkey
  foreign key (rule_id) references compliance_rules(id);

alter table compliance_checks
  drop column if exists rule_code,
  drop column if exists status,
  drop column if exists message,
  drop column if exists observed_value,
  drop column if exists run_id;

alter table compliance_rules
  drop column if exists rule_type,
  drop column if exists fact_key,
  drop column if exists params,
  drop column if exists message,
  drop column if exists category,
  drop column if exists is_placeholder;
