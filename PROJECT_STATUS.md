# MicroX — Project Status

Branch: `claude/microx-setup-spec-review-wabz9w` · PR #1 (open, draft)
Baseline verified 2026-07-16 against local Postgres 16: 225 tests passing, 2 todo, typecheck/lint/format clean, build compiles.

## Epic inventory

| Epic | Requirement | Status | Implementation evidence | Test evidence | Runtime evidence | Remaining |
|---|---|---|---|---|---|---|
| EP-01 | Setup & foundation | Complete and verified | Next.js/TS strict, RTL shell, CI | build + lint | build | — |
| EP-02 | Database & storage | Complete and verified | 52-table schema, migrations, RLS, soft delete | ep02.it | migrate | — |
| EP-03 | Program & stage | Complete and verified | programService, stages | BR-001/002 tests | — | — |
| EP-04 | Sources & files | Complete and verified | secure upload, redaction | redaction test | — | — |
| EP-05 | OCR & extraction | Complete and verified | extraction + low-conf gate | TC-09 | — | — |
| EP-06 | OpenRouter & settings | Complete and verified | LLMProvider, encrypted key | ep06.it | mock only | live at EP-23 |
| EP-07 | RAG & knowledge | Complete and verified | grounding, schema-retry, conflict | ep07.it | — | — |
| EP-08 | Labor-market analysis | Complete and verified | approval precondition | ep08.it | — | — |
| EP-09 | Program generator | Complete and verified | async jobs, preview-before-apply | ep09.it | — | — |
| EP-10 | Courses & alignment | Complete and verified | BR-001/003, gap detectors | ep10.it | — | — |
| EP-11 | Content & ID | Complete and verified | formative-only BR-009 | ep11.it | — | — |
| EP-12 | Hours & scheduling | Complete and verified | BR-002/003/005/006 | TC-02/03/04/05 | — | — |
| EP-13 | Question bank | Complete and verified | balance + CLO linkage | TC-07 | — | — |
| EP-14 | References | Complete and verified | verify + reject/flag | TC-10 | — | — |
| EP-15 | Word templates | Complete and verified | fill original .docx, CI guard | fillEngine, guard | — | TC-08 pending V-01/V-06 |
| EP-16 | Compliance & gate | Complete and verified | data-driven rules, BR-019 gate | TC-11/TC-12, ep16.it | — | V-05 values pending |
| EP-17 | Quality engine | Complete and verified | six-axis, advisory, confidence | qualityEngine, ep17.it | — | — |
| EP-18 | Center feedback | Complete and verified | feedbackService, versioning helper | ep18.it | — | — |
| EP-19 | Versioning & published lock | Complete and verified | versioningService, publish lock | TC-13/TC-14, ep19.it | — | — |
| EP-20 | Dashboard & metrics | Complete and verified | metricsRepo, xlsxWriter | ep20.it, xlsxWriter | — | — |
| EP-21 | Export package | Complete and verified | exportPackageService (gate-first, index) | ep21.it | — | TC-08 field-gate pending V-01/V-06 |
| EP-22 | Test consolidation | Complete and verified | tcMatrix.it (TC-01..14) + CI build/format steps | tcMatrix.it | — | TC-08 todo (V-01/V-06) |
| EP-23 | Deployment & live | Blocked by external credentials | env scaffold | — | — | Supabase/OpenRouter/Vercel |
| EP-24 | Operations | Missing | — | — | — | logging/backup drill |

## Statuses legend
Complete and verified · Complete but regression verification pending · Partially implemented · Present but defective · Missing · Blocked by owner-supplied V-point · Blocked by external credentials · Deferred by approved epic sequence
