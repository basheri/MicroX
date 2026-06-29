# 10 — Business Rules (BR-001..020)

Enforce in the service layer AND as automated tests/CI. DB CHECK constraints back the numeric ones (see `db/schema.sql`).

## Structure & hours (deterministic, blocking)
- **BR-001** A program has **2 to 6** courses. Block <2 or >6.
- **BR-002** Program total credit hours **3 to 23**. Block outside range.
- **BR-003** Each course **1 to 10** credit hours.
- **BR-004** 1 credit hour = **15 actual learning hours** (fixed conversion).
- **BR-005** Max **15 actual hours per week** of learner load. Block any schedule above it.
- **BR-006** Each course's hour distribution must **sum to credit_hours × 15**. Auto-recompute and block mismatches.
- **BR-007** Asynchronous self-paced delivery is the primary mode.

## Assessment
- **BR-008** Passing is determined **only** by the final comprehensive exam.
- **BR-009** Formative activities are **not** counted toward passing.

## Methodology & paths
- **BR-011** Reusable-units (DNA) methodology for content units. *(Definition unknown — see V-03.)*
- **BR-012** Exactly **6** development paths; one is selected/approved per program. *(Official names/durations unknown — see V-02.)*

## Completeness & template
- **BR-013** Program card + program document have required fields; missing required fields **block export**. *(Exact field list unknown — see V-01.)*
- **BR-014** A program is exportable only when all mandatory sections are complete.
- **BR-015..018** Academic consistency must hold across the alignment chain: need → skill → PLO → CLO → unit → content → activity → question. Gaps are warnings.

## Export gate & publishing
- **BR-019** A **mandatory (blocking) error stops export.** Low quality does **not** block export but requires a justification that is saved to the audit log.
- **BR-020** A **published** version is locked and immutable. Updates open a new version cycle (new chain linked to the original); the published copy is retained; both versions are comparable.

## CI enforcement (must have failing tests for)
BR-001, BR-002, BR-003, BR-005, BR-006, BR-008/009 (formative not counted), BR-013 (block export), BR-019 (gate), BR-020 (lock).
