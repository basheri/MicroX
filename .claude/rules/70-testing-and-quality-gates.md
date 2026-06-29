# 70 — Testing & Quality Gates

## Layers
Unit · integration · API · database/RLS/storage · document-generation & template-fidelity · OCR & Arabic-RTL · LLM-output-schema / hallucination / RAG / reference-verification · compliance & quality-scoring · versioning & backup-restore · security · performance · E2E · UAT.

## Mandatory boundary test cases (must exist and pass)
| ID | Case | Expected | Rule |
|---|---|---|---|
| TC-01 | <2 or >6 courses | block + range message | BR-001 |
| TC-02 | total <3 or >23 hours | block | BR-002 |
| TC-03 | course <1 or >10 | block | BR-003 |
| TC-04 | weekly load >15 actual hours | block | BR-005 |
| TC-05 | course hours ≠ credits×15 | block + recompute | BR-006 |
| TC-06 | outcome not covered by content/exam | quality warning | §quality |
| TC-07 | question not linked to an outcome | warning + balance block | §17 |
| TC-08 | official template missing fields | blocking error | BR-013 |
| TC-09 | low-confidence source | block use until approved | AI-005 |
| TC-10 | fake/unverifiable reference | reject + flag | AI-004 |
| TC-11 | export with a blocking error | export prevented | BR-019 |
| TC-12 | export with low quality + justification | allowed + justification saved | BR-019 |
| TC-13 | edit a published version | blocked + opens update cycle | BR-020 |
| TC-14 | restore a prior version | new version + audit entry | §versioning |

## Gates
- A Definition of Done per Epic (in `.claude/tasks/backlog.md`).
- **No** progression to the next Epic until that Epic's tests are green and the owner approves.
- Business-rule limits and the no-HTML→Word rule are enforced in CI; a violation fails the build.
