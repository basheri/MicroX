# MicroX — Deployment Runbook (EP-23)

Target stack (fixed): **Next.js on Vercel · Supabase (Postgres + Storage) · OpenRouter behind `LLMProvider`**.

> **EXTERNAL BLOCKER.** The live deployment cannot be executed from this environment — it
> requires owner-supplied credentials and infrastructure access. Everything that can be
> built without them (edge access control D-07, rollout flags, migrations, config, this
> runbook) is implemented and verified. The steps below are ready to run the moment the
> credentials are provided. Do NOT commit any real secret — all secrets go in Vercel /
> Supabase env settings (SEC-008).

## Blocked on (owner must provide)
- Supabase project URL + anon key + **service-role key** (server only).
- Postgres connection string (`DATABASE_URL`).
- **OpenRouter API key** + the chosen model id (set via the Settings screen, not env).
- Vercel project + deploy authorization.
- **IP allow-list range** for the Deanship network (D-07) → `IP_ALLOWLIST`.
- Production domain/origin → `ORIGIN_ALLOWLIST`.

## 1. Supabase
1. Create the project; copy URL + anon key + service-role key.
2. Apply migrations from a clean database (source of truth = `supabase/migrations/*.sql`):
   ```bash
   DATABASE_URL="<supabase-postgres-url>" npm run db:migrate
   ```
   Verified locally: all 9 migrations apply from an empty database and the snapshot
   (`db/schema.sql`) regenerates deterministically.
3. Create the private Storage bucket for uploads/generated files (no public URLs; serve
   via short-lived signed URLs only — SEC-007).
4. RLS: every table has RLS enabled with the v1 permissive policy (`USING (true)`), ready
   to tighten later with no data migration (rule 30). No per-user policy is assumed (no login).

## 2. Environment / secrets (Vercel project settings)
Set from `.env.example` — never commit:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(server scope only), `DATABASE_URL`, `APP_ENCRYPTION_KEY` (secrets-at-rest, SEC-002),
`IP_ALLOWLIST`, `ORIGIN_ALLOWLIST`, `NEXT_PUBLIC_FEATURE_FLAGS`.
The OpenRouter key is entered in the **Settings** screen and stored **encrypted** in the
DB (masked after save) — it is never returned to the browser and is not an env var (D-02).

## 3. OpenRouter
- Access is only through `LLMProvider` (`OpenRouterProvider`) — no model id is hard-coded.
- Use the Settings connection test before first use; token usage + cost are logged in
  `llm_requests` (no cost cap — transparency only).
- Redaction runs before every model call (SEC-006). The mock provider stays available for
  tests; **live calls never run in CI**.

## 4. Vercel
1. Import the repo; framework auto-detected (`vercel.json` pins Next.js + region).
2. Set the env vars above (Production + Preview scopes as appropriate).
3. Deploy. `npm run build` is verified green locally.

## 5. IP allow-list (D-07 — required, not optional)
- Implemented as edge middleware (`src/middleware.ts` + `src/lib/accessControl.ts`).
- Set `IP_ALLOWLIST` to the Deanship range(s) (IPv4 / CIDR). When set, requests from other
  IPs get **403** (fail-safe). When empty the gate is OFF (dev only) — production MUST set it.
- Optionally set `ORIGIN_ALLOWLIST` for browser-origin defense in depth.
- Unit-tested in `src/lib/accessControl.test.ts` (exact IP, CIDR, deny-on-miss, missing-IP).

## 6. Gradual rollout
- Feature flags via `NEXT_PUBLIC_FEATURE_FLAGS` (`src/lib/flags.ts`) gate each capability;
  enable incrementally, verify, then widen.

## Post-deploy smoke checklist
- App loads behind the IP allow-list; an off-list IP is refused.
- A program can be created; a write is attributed + audited.
- Settings connection test to OpenRouter succeeds.
- A Word document fills the original template (never HTML→Word).
- The compliance gate blocks a non-compliant export; a low-quality export saves a justification.
