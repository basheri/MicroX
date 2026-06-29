# MicroX Backlog — 24 Epics (EP-01 → EP-24)

Execute in order, respecting dependencies. No timelines (sequence + priority only).
Each Epic: **Goal · Key tasks · Dependencies · Priority · Definition of Done (DoD)**.
Priority: Must / Should / Could.

---

## EP-01 — Project setup & foundation · Must · deps: none
**Goal:** Scaffold a clean, typed Next.js + TS app on Vercel with strict RTL shell, layered structure, CI, and feature flags.
**Tasks:** repo + lint/format/typecheck; CI pipeline; RTL global layout + Arabic font + bidi utilities; folder architecture (ui / services / domain / data); `actor_name` capture (localStorage) + audit middleware; feature-flag mechanism.
**DoD:** app deploys to Vercel preview; RTL shell renders; `actor_name` prompt works; CI runs lint+typecheck+tests on PR.

## EP-02 — Database & storage · Must · deps: EP-01
**Goal:** Apply the 52-table schema with RLS, storage bucket, soft delete, and migrations.
**Tasks:** run `db/schema.sql` as migrations; enable RLS `USING(true)`; seed lookups (sectors/fields + 6 development_paths placeholder — see V-02); private storage bucket + signed-URL helper; soft-delete views; `deleted_items` restore path.
**DoD:** migrations run clean; RLS on; CRUD on `programs` works with audit + soft delete; signed URL retrieves a test file.

## EP-03 — Program & stage management · Must · deps: EP-02
**Goal:** Program CRUD + 14 stages / 10 sub-statuses + base dashboard list.
**Tasks:** create (name+sector+field only); stage machine + `program_status_history`; computed `completion_pct`, `blocking_errors`, `warnings_count`; list/filter/search.
**DoD:** create→advance stage works; status history recorded; dashboard lists + filters by sector/field/path/stage/approval.

## EP-04 — Sources & files · Must · deps: EP-02
**Goal:** Secure upload of official files + storage + redaction logging.
**Tasks:** upload (PDF/DOCX/XLSX, MIME+size+malware checks); store private; `program_sources`; redaction pipeline + `redaction_logs`.
**DoD:** disallowed types rejected; file stored + signed-URL retrievable; redaction removes PII and logs it (TC for SEC-006).

## EP-05 — OCR & extraction · Should · deps: EP-04
**Goal:** Extract text/tables with page/location + confidence + human review gate.
**Tasks:** text/table extraction; OCR for scanned PDFs; `extracted_file_content` (page, bbox, confidence, source_class); `extraction_reviews`; block low-confidence use until approved.
**DoD:** extraction stored with confidence; low-confidence blocked until reviewed (TC-09).

## EP-06 — OpenRouter & settings · Must · deps: EP-01
**Goal:** `LLMProvider` abstraction + Settings + encrypted key + connection test.
**Tasks:** `LLMProvider` interface; `llm_settings` (model_id, encrypted key); Settings screen; connection test endpoint; `llm_requests` logging (tokens/cost, no cap).
**DoD:** model set from Settings; key stored encrypted + masked; connection test passes/fails clearly; requests logged.

## EP-07 — RAG & knowledge engine · Must · deps: EP-05, EP-06
**Goal:** Grounded context assembly with source priority.
**Tasks:** chunking + metadata; source-priority ordering; context assembly; conflict surfacing; JSON-Schema-constrained calls + retry.
**DoD:** generation calls return schema-valid output; conflicting sources surfaced; higher-trust source wins (AI-002/003).

## EP-08 — Labor-market analysis · Must · deps: EP-07
**Goal:** Market research → skills → feasibility with evidence, linkable to courses.
**Tasks:** `market_analysis` + `market_skills` + `market_sources`; `feasibility_assessments` (rating + justification when weak); approval step (precondition for generation).
**DoD:** analysis produced with cited sources; feasibility rated; approved analysis unblocks generation.

## EP-09 — Program generator · Must · deps: EP-07, EP-08
**Goal:** Quick + staged generation, section pinning, impact analysis, side-assistant.
**Tasks:** async generation jobs (progress/cancel/regenerate); staged flow; pin sections; `impact-analysis` (no auto-apply); preview-before-apply.
**DoD:** generation runs async with progress; impact analysis lists affected sections without applying (TC for §5).

## EP-10 — Courses, outcomes & alignment · Must · deps: EP-09
**Goal:** Courses/units/lessons + PLO/CLO + alignment matrix with gap detectors.
**Tasks:** course/unit/lesson CRUD; `program_learning_outcomes` + `course_learning_outcomes`; `alignment_matrix`; detectors (uncovered outcome, content without outcome).
**DoD:** alignment chain editable; detectors flag gaps (TC-06).

## EP-11 — Content & instructional design · Must · deps: EP-10
**Goal:** Self-paced content + resources + formative activities (not counted toward passing).
**Tasks:** `learning_resources`, `learning_activities` (formative), `instructional_design_assets`.
**DoD:** content/resources/activities created; activities flagged formative-only (BR-009).

## EP-12 — Hours & scheduling · Must · deps: EP-10
**Goal:** Hour distribution + instant recompute + violation blocking.
**Tasks:** `hour_allocations`, `program_schedules`; recompute endpoint; enforce BR-002/003/005/006.
**DoD:** hours recompute live; violations blocked (TC-02/03/04/05).

## EP-13 — Question bank · Must · deps: EP-10
**Goal:** Balanced generation + quality checks + outcome linkage.
**Tasks:** `question_banks`, `questions`, `question_options`; coverage/difficulty/distractor checks; link each question to a CLO.
**DoD:** questions generated + linked; unlinked question warns + blocks balance (TC-07).

## EP-14 — References & verification · Should · deps: EP-07
**Goal:** Verify reference existence/metadata; Arabic/English lists; classification.
**Tasks:** `program_references`; existence/metadata verification; reject + flag unverifiable.
**DoD:** fake reference rejected (TC-10); verified references listed.

## EP-15 — Templates & Word generation · Must · deps: EP-02
**Goal:** Template management + Mapping Engine + fidelity test. (Needs real template — V-01/V-06.)
**Tasks:** `official_templates`/`template_versions`/`template_fields`/`template_mappings`; mapping engine; `docxtemplater`/OOXML fill of original; `generated_documents`; fidelity + completeness test.
**DoD:** original template filled with structure/RTL preserved; fidelity test passes; missing required field → blocking (TC-08).

## EP-16 — Compliance engine · Must · deps: EP-10, EP-12, EP-15
**Goal:** Data-driven rules engine + export gate.
**Tasks:** `compliance_rules` (editable) + `compliance_checks`; classify blocking/warning/suggestion; export gate (BR-019).
**DoD:** blocking error prevents export; warnings don't; rules editable without rebuild (TC-11/12).

## EP-17 — Quality engine · Should · deps: EP-10, EP-13
**Goal:** Six-axis scores (deterministic + LLM-assist) → `quality_assessments`.
**Tasks:** deterministic detectors; LLM-assisted qualitative scoring with confidence; per-axis + overall score.
**DoD:** scores produced; low quality is a warning (never auto-blocks) per BR-019.

## EP-18 — Center feedback · Should · deps: EP-09
**Goal:** Ingest reviewer feedback → items → tasks → preview-before-apply.
**Tasks:** `center_feedback_files`/`center_feedback_items`; link to sections; `change_proposals`; apply with before/after preview + approval.
**DoD:** feedback applied only after preview+approval; each apply creates a version.

## EP-19 — Versioning & audit · Must · deps: EP-03
**Goal:** JSONB snapshots + publish lock + compare + restore.
**Tasks:** `program_versions` snapshots; publish lock (BR-020); version compare; restore as new version; full `audit_logs` (13 fields).
**DoD:** published version immutable; restore creates new version (TC-13/14); audit complete.

## EP-20 — Dashboard & metrics · Should · deps: EP-03
**Goal:** Aggregations + charts + Excel export.
**Tasks:** metrics endpoints; charts; `dashboard/export.xlsx`.
**DoD:** dashboard shows counts by stage/approval; Excel export works.

## EP-21 — Export package · Must · deps: EP-15, EP-16
**Goal:** Build the full submission package + index + reports.
**Tasks:** assemble filled Word + read copies + card/document/courses/outcomes/content/question-bank/references/appendices; compliance + quality reports; delivery checklist; version log; index file; optional market-report appendix.
**DoD:** package builds only past the compliance gate; index lists every artifact + requirement status; no emails/letters generated.

## EP-22 — Testing · Must · deps: all
**Goal:** Full coverage incl. all boundary cases.
**Tasks:** implement TC-01..14 + layer suites; wire into CI.
**DoD:** all TCs green in CI; BR limits + no-HTML→Word fail the build when violated.

## EP-23 — Deployment · Must · deps: EP-22
**Goal:** Production on Vercel + Supabase + secrets + flags.
**Tasks:** env/secrets; production migrations; IP allow-list (D-07); gradual flag rollout.
**DoD:** production live behind IP allow-list; rollout flags work.

## EP-24 — Operations & monitoring · Should · deps: EP-23
**Goal:** Logging, monitoring, error tracking, backup/restore drill.
**Tasks:** structured logging + request_id; perf + OpenRouter-health + job-queue monitoring; error tracking/alerts; backup metadata + restore test (RPO≤24h/RTO≤4h).
**DoD:** dashboards live; alert on generation/fill failures; a restore drill passes.

---
### MoSCoW summary
- **Must:** EP-01,02,03,04,06,07,08,09,10,11,12,13,15,16,19,21,22,23
- **Should:** EP-05,14,17,18,20,24
- **Could/Future:** advanced path/template comparisons, editor shortcuts, KAU brand theming, tightened RLS if roles are ever introduced.
