# Requirement ID Index

Full definitions live in the design document. This is the lookup map for Claude Code.

## Business Rules (BR-001..020) — see `.claude/rules/10-business-rules.md`
Structure/hours/assessment/methodology/completeness/export-gate/publish-lock.

## Functional modules (FR groups م.1..م.9)
- م.1 Program & dashboard management
- م.2 Sources, files, OCR & extraction
- م.3 Market analysis & feasibility
- م.4 Generation (quick/staged/jobs/impact)
- م.5 Editing, alignment & impact analysis
- م.6 Courses/outcomes/content/instructional design
- م.7 Hours & scheduling
- م.8 Question bank & references
- م.9 Templates, compliance, quality, export, versioning, settings

## Non-Functional (NFR)
- Performance NFR-001..005 · Reliability NFR-010..013 (incl. RPO≤24h/RTO≤4h)
- Usability/Maintainability NFR-020 · UX-001..003 (RTL, clarity, feedback)

## AI (AI-001..008) — see `.claude/rules/20-ai-and-anti-hallucination.md`
RAG · JSON-Schema outputs · source priority · anti-hallucination checks · confidence scoring · human-in-the-loop · OpenRouter abstraction · async jobs.

## Security (SEC-001..008) — see `.claude/rules/40-security-and-privacy.md`
TLS/at-rest · key encryption · API hardening · safe upload · edge protection · redaction · signed URLs · soft-delete+audit+secrets.

## Database (52 tables) — see `db/schema.sql`
## Screens (SC-01..30) — see `docs/screens.md`
