```yaml
microx_progress:
  current_epic: EP-23 Deployment (code+config+docs complete; live deploy EXTERNAL-BLOCKED) → EP-24 next
  current_vertical_slice: IP allow-list (D-07) middleware + rollout flags + deploy runbook + security review
  current_branch: claude/microx-setup-spec-review-wabz9w
  latest_commit: (EP-17 commit)
  completed_epics: EP-01..EP-22 (+EP-23 non-blocked scope)
  verified_epics: EP-01..EP-22 + EP-23 code/config (green tests + build); clean-DB migration verified
  active_tests: vitest (unit + integration on real Postgres)
  tests_passing: 271
  tests_failing: 0
  tests_todo: 1   # TC-08 only (needs V-01/V-06)
  typecheck_status: clean
  lint_status: clean
  format_status: clean
  build_status: compiles
  ci_status: postgres:16 + format:check + build steps (pushed; observe on PR)
  database_status: 9 migrations; local Postgres verified
  rtl_status: Arabic RTL panels for all new UI (SC-19 quality)
  security_status: no secrets committed; .env.example only
  open_v_points: V-01, V-02, V-03, V-04, V-05, V-06, V-07, V-08
  external_blockers: live Supabase / OpenRouter / Vercel credentials (EP-23)
  next_action: EP-24 Operations (logging/health/backup-restore drill on local Postgres)
```
