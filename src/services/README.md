# `services/` — application / use-case layer

Orchestrates use cases by composing `domain/` (rules) and `data/` (persistence).
Every write goes through the audit wrapper (`@/lib/audit` → `withAudit`) so it is
attributed to `actor_name` and recorded in `audit_logs` (rule 00 / rule 30).

Long-running generation use cases run **async via the Job Queue** with progress
(D-05 / AI-008) — added in EP-09. All model access goes through the `LLMProvider`
abstraction (D-02), wired in EP-06.
