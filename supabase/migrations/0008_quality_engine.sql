-- =====================================================================
-- 0008 — Quality engine (EP-17 / SC-19 / AI-005). Six-axis quality scoring.
-- Deterministic detectors grounded in the alignment chain (BR-015..018 / TC-06)
-- plus one LLM-assisted qualitative axis with a confidence level. Quality is
-- ADVISORY: low scores raise WARNINGS and never block export (BR-019) — the export
-- gate is compliance-only.
--
-- The axis taxonomy, weights, and warn thresholds are TUNABLE operational config
-- (src/config/qualityConfig.ts), not invented academic thresholds; the official
-- axis policy, if the guide defines one, drops into that file with no schema change.
-- =====================================================================

alter table quality_assessments
  add column run_id uuid,                       -- groups one assessment pass
  add column axis_label text,                   -- Arabic label shown in SC-19
  add column kind text not null default 'deterministic'
    check (kind in ('deterministic', 'llm_assist', 'overall')),
  add column weight numeric not null default 0, -- axis weight in the overall score
  add column confidence text                    -- AI-005 level for llm_assist axes
    check (confidence is null or confidence in ('low', 'medium', 'high')),
  add column is_warning boolean not null default false,  -- score below warn threshold
  add column evidence jsonb not null default '[]'::jsonb, -- traceable reasons/gaps
  add column created_by_actor text;

create index if not exists idx_quality_run on quality_assessments(run_id);
create index if not exists idx_quality_program on quality_assessments(program_id);
