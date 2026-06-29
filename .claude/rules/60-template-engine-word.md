# 60 — Word Template Engine

The single biggest fidelity risk (R-10). Follow exactly.

- **Fill the original template file.** Inject values into existing Content Controls / Bookmarks using `docxtemplater` or an OOXML library. **Never** rebuild the document, and **never** go HTML→Word.
- **Preserve** the template's structure, tables, field order, styles, and RTL exactly.
- **Template Mapping Engine** links: DB fields ↔ editor sections ↔ template controls/placeholders ↔ repeating tables (courses / units / questions).
- **Template Fidelity Test** + field-completeness check must pass before a generated document is accepted; on failure, mark and stop the output (do not export a malformed file).
- **Template versioning:** keep every template version; diff against the previous; require approval; migrate mappings without losing content (R-11).
- Required template fields that are empty → **blocking error** (BR-013), export halted.

> The exact template mechanism (Content Controls vs Bookmarks vs plain tables) and the exact required field list are unknown until the real template is provided — see V-01 and V-06. Do not assume; flag.
