# MicroX — Open Issues & Owner-Supplied V-Points

These block specific requirements only. All generic engine/schema/UI/test infrastructure
is built and isolated behind swappable, clearly-flagged config so the official values
drop in with zero code change. Placeholder values are never presented as official policy.

| V-point | Owner input required | Impact | Current handling |
|---|---|---|---|
| V-01 / V-06 | Official template field list + filling mechanism | TC-08 (missing-field → block export) | `src/config/templateConfig.ts` placeholder; TC-08 stays `it.todo` until real fields |
| V-05 | Official mandatory fields that block export | Final compliance blocking rules | `src/config/complianceConfig.ts` placeholder rules flagged `isPlaceholder`; `hasPlaceholderRules()` surfaces it |
| V-02 | 6 development-path names + durations | Path selection UI | schema placeholders; not fabricated |
| V-03 | DNA reusable-units methodology | Content-unit rules | generic content units only |
| V-04 | Additional official numeric rules | Extra validations | none invented |
| V-07 | Official language policy | Language validations | none invented |
| V-08 | Guide-vs-template conflict resolution | Compliance/export | surfaced by source priority (AI-003) |

## External blockers (EP-23 / EP-24)
- Live **Supabase** project + service-role key — needed for remote migrations, storage, RLS verification.
- Live **OpenRouter** API key — needed to test `LLMProvider` against the real gateway.
- **Vercel** project + deploy credentials — needed for staging/production deploy.
- **IP allow-list** range for the Deanship network (D-07).
- GitHub connector re-authorization — needed to update PR #1 body from the session (code push works via git).

## Notes
- TC-08 must NOT be marked passing using invented template fields.
- V-05 must NOT be inferred from existing placeholders.
- V-02 / V-03 must NOT be fabricated for interface completeness.
