```yaml
microx_progress:
  current_epic: EP-20 Dashboard & metrics (complete) → EP-21 next
  current_vertical_slice: real DB metric aggregations + minimal-OOXML .xlsx export (no new dep)
  current_branch: claude/microx-setup-spec-review-wabz9w
  latest_commit: (EP-17 commit)
  completed_epics: EP-01..EP-20
  verified_epics: EP-01..EP-20 (green tests + build)
  active_tests: vitest (unit + integration on real Postgres)
  tests_passing: 246
  tests_failing: 0
  tests_todo: 1   # TC-08 only (needs V-01/V-06)
  typecheck_status: clean
  lint_status: clean
  format_status: clean
  build_status: compiles
  ci_status: postgres:16 workflow present (pushed; observe on PR)
  database_status: 9 migrations; local Postgres verified
  rtl_status: Arabic RTL panels for all new UI (SC-19 quality)
  security_status: no secrets committed; .env.example only
  open_v_points: V-01, V-02, V-03, V-04, V-05, V-06, V-07, V-08
  external_blockers: live Supabase / OpenRouter / Vercel credentials (EP-23)
  next_action: EP-21 Export package
```
