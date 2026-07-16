# MicroX — Operations (EP-24)

## Observability
- **Structured logging** (`src/lib/logger.ts`): single-line JSON, `requestId` correlation,
  and automatic redaction of secrets/PII by key (SEC-006/008) — verified in `logger.test.ts`.
- **Health endpoint** `GET /api/health` (`healthService.getHealth`): DB liveness + operational
  failure signals (failed generation jobs, failed exports, low-fidelity documents). Returns
  **503** when a critical component is down so uptime monitors alert.
- **Alerting signals** (wire to the monitor of choice on deploy): `failedGenerationJobs`,
  `failedExports`, `lowFidelityDocuments` — the generation/fill-failure alerts required by EP-24.

## Backup & restore
- Targets: **RPO ≤ 24h, RTO ≤ 4h** (rule 30). Production uses Supabase PITR + a documented
  daily logical snapshot recorded in `backup_metadata`.
- **Restore drill** (`scripts/ops/restore-drill.sh`): real dump → drop → recreate → restore →
  verify (table + row counts). Never run against production.

### Executed drill evidence (local Postgres 16)
```
[drill] source=microx_test restore=microx_restore_drill
[drill] dump written (151409 bytes)
[drill] restore complete
[drill] tables: source=73 restored=73
[drill] programs: source=1 restored=1
[drill] PASS — schema + data restored identically
```
The drill was **executed**, not just documented: schema (73 public tables) and data
(programs row count) restored identically. `recordBackupEvent` appends the outcome to
`backup_metadata`.

## Runbooks
- **Rollback**: redeploy the previous Vercel build; DB changes are forward-only numbered
  migrations with matching `down/` files (`node scripts/db/migrate.mjs --down`).
- **Env recovery**: all secrets live in Vercel/Supabase settings (never in git); re-enter the
  OpenRouter key via Settings (stored encrypted).
- **Incident**: check `/api/health` → inspect structured logs by `requestId` → check
  `generation_jobs` / `export_packages` failure rows → act.
- **Dependency updates**: `npm ci` from lockfile; CI (format/lint/typecheck/test/build) gates every change.

## Ownership
Product owner: أ.د. محمد زيد بشيري (Vice Dean, E-Learning, KAU). Operational changes go through
the CI-gated PR flow on the development branch.
