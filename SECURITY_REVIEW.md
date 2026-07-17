# MicroX — Security Review (SEC-001..008 + no-login compensations)

Posture at EP-23. Code-level controls verified; infrastructure controls are ready and
activate with owner-supplied credentials (see DEPLOYMENT.md).

| Control | Requirement | Status | Evidence |
|---|---|---|---|
| SEC-001 | TLS in transit + encryption at rest | Infra (Supabase/Vercel default) | activated on deploy |
| SEC-002 | OpenRouter key encrypted server-side, masked after save | Implemented | `llmSettingsService` + `lib/crypto`; key never returned in full |
| SEC-003 | Input validation, parameterized queries, output encoding, CSRF | Implemented | all SQL parameterized (`$1`…); XLSX/HTML escaping; API input checks |
| SEC-004 | Safe upload: type allow-list, real-MIME, size, storage outside app root | Implemented | `uploadValidation` (PDF/DOCX/XLSX), `malwareScan` seam, private bucket |
| SEC-005 | Edge protection: per-IP allow-list, origin allow-list | Implemented | `middleware.ts` + `accessControl` (D-07); unit-tested |
| SEC-006 | Redaction before any model call | Implemented | `domain/redaction` + logged in `redaction_logs` |
| SEC-007 | Short-lived signed URLs only; no permanent public links | Implemented | private bucket; generated packages stored privately |
| SEC-008 | Soft delete + full audit + secrets via env | Implemented | `withAudit` on every write; `.gitignore` blocks `.env*`; only `.env.example` tracked |

## No-login compensations (R-01)
1. **IP allow-list** (D-07) — first line of defense; `IP_ALLOWLIST` env, fail-safe deny. Required in production.
2. **Rotatable link** — operational (unguessable URL).
3. **Mandatory `actor_name` + full audit** — every write goes through `withAudit`; anonymous writes are rejected by construction (tested across every service).
4. **Soft delete + versions + restore** — tampering is reversible; published versions are immutable (BR-020).

## Secret hygiene
- No secret is committed. `git ls-files` tracks only `.env.example` (placeholders).
- The OpenRouter key lives encrypted in the DB (entered via Settings), never in env or the client bundle.
- Service-role key is server-scope only; never shipped to the browser.

## Residual / pending
- Live TLS/at-rest, malware-scan engine binding, and rate-limit tuning finalize on deploy (EP-23/EP-24).
- Tightened per-role RLS is intentionally deferred (no login in v1); structure is ready without data migration.
