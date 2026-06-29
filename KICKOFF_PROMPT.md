# Kickoff Prompt for Claude Code (copy–paste)

Paste the block below as your first message to Claude Code after opening this repo.

---

You are the lead engineer building the MicroX platform for the KAU Deanship of E-Learning.

Before writing any code:
1. Read `CLAUDE.md`, every file in `.claude/rules/`, `db/schema.sql`, `docs/requirements.md`, `docs/screens.md`, and `docs/verification-points.md`.
2. Summarize back to me, in 15 lines max: the non-negotiable constraints, the 8 locked decisions, and anything in the spec that is ambiguous or missing (especially the V-01..V-08 verification points).
3. Do NOT invent any business rule, template field, or academic constraint. If you need the official Word template or NELC guide and it is not in the repo, STOP and list exactly what you need under the matching V-point. Guessing is a defect.

Then propose a plan for EP-01 only (project setup), in plan mode. Wait for my approval before executing.

Rules of engagement for the whole project:
- Work strictly phase by phase using `.claude/tasks/backlog.md`, EP-01 → EP-24, respecting dependencies.
- After each Epic: write/run the tests defined for it, show me green results, and wait for my approval before the next Epic.
- Enforce business-rule limits (course count, credit hours, weekly load, hours = credits×15) and the "no HTML→Word" rule as automated tests in CI — not just in code comments.
- Arabic-only UI, strict RTL, English terms bidi-isolated, Western numerals.
- No login. Single fixed OpenRouter model swappable only from Settings, behind an LLMProvider abstraction. Redact personal data before any model call.
- Every write attributed to `actor_name` and recorded in `audit_logs`. Soft delete + version snapshots everywhere.
- All long generation runs async via a Job Queue with progress.

Confirm you understand, complete steps 1–3, then stop for my approval.

---

## What I (the owner) will provide on request
- GitHub repo (this kit) · Vercel account · Supabase project · OpenRouter API key + chosen model id.
- IP allow-list range for the Deanship network.
- The official Word templates (program card, program document, course descriptor) + the NELC guide — needed to close V-01..V-08.
- One real sample program (Golden Sample) to validate output against.
