# 00 — Hard Constraints (never violate)

These are absolute. Each maps to an explicit owner requirement. If a task seems to require breaking one, STOP and flag it.

## Identity & access
- **No login, no accounts, no roles.** Anyone with the platform link has every permission.
- User enters their name once per session; store in browser `localStorage` as `actor_name`.
- Every write operation carries `actor_name` and is recorded in `audit_logs`.

## Stack (fixed)
- Next.js + TypeScript on Vercel. Supabase (PostgreSQL + Storage). OpenRouter single gateway.
- Modular Monolith. No microservices. No alternative DB, hosting, or framework.

## LLM
- Exactly **one** model active at a time, selected in Settings, changeable only from Settings.
- Access OpenRouter only through an `LLMProvider` abstraction. No model id hard-coded in business logic.
- **No cost caps.** Log token usage and cost in `llm_requests` for transparency only.

## Files
- Accept **PDF, DOCX, XLSX only**. Reject every other type (extension + real MIME check).
- Private Supabase Storage bucket. Access only via short-lived Signed URLs. No permanent public links.

## Privacy
- **Redaction pipeline runs before any content goes to the model.** Remove names, national IDs, emails, phone numbers. Log each redaction in `redaction_logs`.

## Word export
- Fill the **original** Word template via Content Controls / Bookmarks (`docxtemplater`/OOXML).
- **Never** generate Word from HTML. Never change the template's structure, tables, or field order. Preserve RTL.

## Data lifecycle
- **Soft Delete** (`is_deleted`) everywhere deletable, with a restorable copy in `deleted_items`.
- **Full audit trail** on every write. **Version snapshots** (JSONB) on every meaningful change.

## Explicitly out of scope (do not build)
- Concurrent/collaborative editing or edit locks.
- Any direct integration with NELC (export is manual upload by the user).
- Generating emails, cover letters, or any official correspondence.
- Program timelines, schedules with deadlines, or due dates.
- Copying/cloning a previous program when creating a new one.
- An English UI (Arabic only in v1).
