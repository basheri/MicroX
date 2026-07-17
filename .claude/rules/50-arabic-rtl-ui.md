# 50 — Arabic RTL UI

- **Global RTL enforcement:** `direction: rtl` and right-alignment by default on the whole UI. Arabic only in v1.
- **Bidi isolation:** wrap embedded English terms, code, URLs, and IDs in an LTR isolated span (`unicode-bidi: isolate`, `dir="ltr"`) inside the right-aligned container, so they don't break Arabic flow.
- **Numerals:** Western numerals (0–9) throughout.
- **Typography:** Arabic font sized at least equal to (ideally 1–2pt larger than) the Latin fallback; line-height ≥ 1.5; Arabic quotation marks «...».
- **Forms & tables:** labels right-aligned; table reading order RTL; mixed Arabic/English cells handled with isolation.
- **Validation messages** (e.g., business-rule violations) written in clear Arabic, with the rule reference.
