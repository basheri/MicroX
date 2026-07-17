```yaml
microx_progress:
  current_epic: Post-EP-24 usability — navigation & program workspace (complete)
  current_vertical_slice: global nav + /programs/[id] workspace wiring all panels to real APIs + /dashboard + /settings
  current_branch: claude/microx-setup-spec-review-wabz9w
  latest_commit: (EP-17 commit)
  completed_epics: EP-01..EP-22, EP-24 (+EP-23 non-blocked scope)
  verified_epics: EP-01..EP-24 code (green tests + build); clean-DB migration + restore drill executed
  active_tests: vitest (unit + integration on real Postgres)
  tests_passing: 281
  tests_failing: 0
  tests_todo: 2   # TC-08 (V-01/V-06); guardrails placeholder repeats it
  typecheck_status: clean
  lint_status: clean
  format_status: clean
  build_status: compiles
  ci_status: postgres:16 + format:check + build steps (pushed; observe on PR)
  database_status: 9 migrations; local Postgres verified (clean-DB migrate + restore drill executed)
  rtl_status: Arabic RTL across all pages incl. new nav/workspace/dashboard/settings
  security_status: no secrets committed; .env.example only
  open_v_points: V-01, V-02, V-03, V-04, V-05, V-06, V-07, V-08
  external_blockers: live Supabase / OpenRouter / Vercel credentials (EP-23)
  next_action: only external blockers remain (live deploy creds + NELC template V-01/V-06). App is navigable end-to-end.
```
