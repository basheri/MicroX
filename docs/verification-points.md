# Verification Points (V-01..V-08) + Required Inputs

Claude Code must STOP and flag these where the official artifact is needed and absent. Do not guess.

## Must be confirmed against the latest official template / NELC guide
- **V-01** Exact fields of the **Program Card** and **Program Document** (names, order, required flags, repeating tables).
- **V-02** Official **names and durations** of the **6 development paths**, and the eligibility conditions for each.
- **V-03** **DNA reusable-units** methodology details (definition, fields, chunking rules).
- **V-04** Any extra numeric rules in the guide not stated explicitly (ratios, minimum activity counts, final-exam requirements).
- **V-05** The official list of **mandatory fields that block export** (to seed `compliance_rules`).
- **V-06** The template mechanism (**Content Controls vs Bookmarks vs plain tables**) to configure the Template Mapping Engine.
- **V-07** Center-approved **language/terminology policies** (if any) to feed the language engine.
- **V-08** Any **conflict between guide and template** — surface to the user before approval, by source priority.

## Inputs the owner provides (not buildable without them)
1. GitHub repo (this kit) · Vercel account · Supabase project · OpenRouter API key + model id.
2. IP allow-list range for the Deanship network (D-07).
3. Official Word templates (program card, program document, course descriptor) + NELC guide → closes V-01..V-08.
4. One real sample program (Golden Sample) for output validation.

> Setup, database, OpenRouter integration, market analysis, and generation can all start **before** V-points are closed. Only the compliance engine (EP-16) and Word-fill engine (EP-15) are blocked by them.
