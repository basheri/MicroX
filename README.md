# MicroX — Claude Code Execution Kit

This repository is a **ready-to-build handoff package** for the MicroX platform. Drop it into an empty GitHub repo, open it with Claude Code, and drive the build phase by phase.

## What's inside
| Path | Purpose |
|---|---|
| `CLAUDE.md` | The behavioral contract Claude Code reads automatically every session. Constraints + 8 locked decisions + operating model. |
| `KICKOFF_PROMPT.md` | The exact first message to paste into Claude Code. |
| `.claude/rules/` | Modular, enforceable rules (hard constraints, business rules, AI/anti-hallucination, database, security, Arabic RTL, Word template engine, testing & gates). |
| `.claude/tasks/backlog.md` | The 24 Epics (EP-01 → EP-24) decomposed into tasks, with dependencies, priority, and Definition of Done. |
| `db/schema.sql` | Full PostgreSQL/Supabase DDL for all 52 tables (keys, business-rule CHECK constraints, indexes, soft-delete/audit columns). |
| `docs/requirements.md` | Index of every requirement ID (BR / FR / NFR / AI / SEC / UX). |
| `docs/screens.md` | Registry of all 30 screens (SC-01..30). |
| `docs/verification-points.md` | V-01..V-08 — what must be confirmed against the real template before final build, plus the 5 inputs the owner must provide. |

## How to use it (6 steps)
1. Create an empty GitHub repo and commit this entire folder to it.
2. Provision: Vercel account, Supabase project, OpenRouter API key (+ model id).
3. Open the repo in Claude Code. Paste the contents of `KICKOFF_PROMPT.md`.
4. Approve the EP-01 plan, then let it build. Connect Supabase/Vercel when asked.
5. After each Epic: confirm tests are green, review, approve, move on.
6. The moment Claude Code asks for an official template field or an NELC rule it doesn't have — give it the real template (V-points). Until then it must flag, not guess.

## The one thing that blocks high quality
The compliance engine and the Word-fill engine are the heart of the product, and both depend on the **real official templates + NELC guide**. Provide them early. Everything else (setup, database, OpenRouter, market analysis, generation) can start in parallel without them.
