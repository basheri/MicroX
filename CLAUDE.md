# MicroX — Project Memory (Behavioral Contract)

> This file is the supreme law of the repo. If any prompt conflicts with it, this file wins.
> Keep it small and stable. Deep/topic-specific rules live in `.claude/rules/`.

## What MicroX is
An AI-powered web platform for the **Deanship of E-Learning, King Abdulaziz University (KAU)** that lets a team build **short university programs (MicroX / micro-credentials)** end-to-end — from labor-market analysis, through program/course/content/question-bank generation, to a fully filled **official Word export package** ready for manual submission to the Saudi **NELC**.

Owner (product): **أ.د. محمد زيد بشيري**, Vice Dean, E-Learning, KAU.
Primary users: instructional designers and academic coordinators at the Deanship. Single user works on a given program at a time.

## Tech stack (fixed — do not propose alternatives)
- **Next.js + TypeScript**, deployed on **Vercel**.
- **Supabase** (PostgreSQL + Storage) for data and files.
- **OpenRouter** as the single LLM gateway, behind an abstraction layer.
- **Architecture:** Modular Monolith (not microservices). Clean, typed, layered.

## Non-negotiable constraints (full list in `.claude/rules/00-hard-constraints.md`)
1. **No login / no accounts.** Anyone with the link has all permissions. User types their name once (stored in browser `localStorage` as `actor_name`); every write is attributed to it.
2. **Arabic-only UI, strict RTL.** English technical terms are bidi-isolated. Western numerals.
3. **One fixed LLM model** chosen in Settings, swappable from Settings only — never hard-coded in logic. No cost caps (log cost only).
4. **Uploads:** PDF / DOCX / XLSX only.
5. **Redaction before the model:** strip names/IDs/emails/phones before any file/text is sent to OpenRouter.
6. **Word export = fill the ORIGINAL template** (Content Controls/Bookmarks). Never HTML→Word. Never alter template structure/tables/field order. Preserve RTL.
7. **Soft Delete + full Audit + version restore** are mandatory everywhere.
8. **No concurrent editing**, no NELC integration, no official-correspondence generation, no program timelines/deadlines, no copying prior programs on creation.

## The 8 locked technical decisions (do not re-litigate)
- D-01 Modular Monolith on Next.js.
- D-02 OpenRouter behind an `LLMProvider` abstraction (model swap never touches logic/data).
- D-03 Anti-hallucination = RAG + deterministic validation + confidence scoring + mandatory human-in-the-loop. Promise = "no unverified content reaches the official package" (NOT "zero hallucination").
- D-04 Fill original Word via `docxtemplater`/OOXML. No HTML→Word.
- D-05 Generation runs **async** via a Job Queue with progress (Vercel function timeout safety).
- D-06 Versioning via full JSONB snapshots + soft delete.
- D-07 IP allow-list as first line of defense (compensates for no-login).
- D-08 Data-driven Rules Engine (compliance rules editable in DB, no rebuild).

## How to work in this repo (operating model)
- **Execute phase by phase** following `.claude/tasks/backlog.md` (EP-01 → EP-24). Do NOT attempt the whole platform at once.
- After each Epic: tests green + human approval **before** starting the next.
- **NEVER invent a business rule, a template field, or an academic constraint.** Where the official template/guide is needed and absent, STOP and flag it against `docs/verification-points.md` (V-01..V-08). Flagging is correct; guessing is a defect.
- Business-rule limits and the no-HTML→Word rule must be **enforced in tests/CI**, not only in prose.
- When a spec section gives a "template + examples" (screens, tables, workflows), apply the template literally to the rest and produce a checklist of everything you generated for human review.

## Where things are
- Hard constraints & rules → `.claude/rules/`
- Database schema (52 tables) → `db/schema.sql`
- Requirement IDs index → `docs/requirements.md`
- Screen registry (SC-01..30) → `docs/screens.md`
- What to confirm before final build → `docs/verification-points.md`
- Work plan → `.claude/tasks/backlog.md`
