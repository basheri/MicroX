# `domain/` — business rules & academic logic

Pure, framework-free, fully testable. No Next.js, React, or DB imports here.

This layer will host the deterministic **business-rule** validators (BR-001..020,
`.claude/rules/10-business-rules.md`) and the academic-consistency checks. Each
validator is enforced here **and** mirrored by a failing CI test (rule
70-testing-and-quality-gates) so a violation breaks the build.

> No business-rule **thresholds** are invented. Only values written in
> `.claude/rules/10-business-rules.md` are encoded; anything missing is a V-point
> and stays flagged, not guessed.

Populated by the epics that own each rule: courses/outcomes (EP-10), hours &
scheduling (EP-12), question bank (EP-13), compliance (EP-16).
