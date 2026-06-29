# Screen Registry (SC-01..30)

Arabic RTL. Each screen: purpose + key rule it enforces + primary module.
Build screens within their Epic. Apply this registry literally; flag any field that depends on the official template (V-points).

| ID | Screen | Purpose / key rule | Module |
|---|---|---|---|
| SC-01 | Name entry (session) | Capture `actor_name` → localStorage; gates all writes | EP-01 |
| SC-02 | Create program | Name + sector + field only; no cloning prior programs | EP-03 |
| SC-03 | Dashboard / program list | Filters: sector/field/path/stage/approval; counts | EP-03/20 |
| SC-04 | Program overview | Completion %, blocking errors, warnings, stage | EP-03 |
| SC-05 | Stage tracker | 14 stages / 10 sub-statuses + history | EP-03/19 |
| SC-06 | Sources & upload | PDF/DOCX/XLSX only; redaction notice | EP-04 |
| SC-07 | Extraction review | Page/location + confidence; low-confidence blocked | EP-05 |
| SC-08 | Market analysis | Trends/roles/skills + sources; approve to proceed | EP-08 |
| SC-09 | Feasibility | Rating + justification when weak | EP-08 |
| SC-10 | Development path | Select/approve 1 of 6 paths (V-02) | EP-09 |
| SC-11 | Program structure | Outcomes + course list (2..6, BR-001) | EP-09/10 |
| SC-12 | Program learning outcomes | Measurable PLOs | EP-10 |
| SC-13 | Course editor | Title + credit hours (1..10, BR-003) | EP-10 |
| SC-14 | Course outcomes (CLO) | Measurable; linked to PLOs | EP-10 |
| SC-15 | Hours & schedule | Live recompute; BR-002/005/006 enforced | EP-12 |
| SC-16 | Units / lessons / content | Self-paced; activities formative-only (BR-009) | EP-11 |
| SC-17 | References | Verify existence; reject fakes; AR/EN lists | EP-14 |
| SC-18 | Compliance panel | Blocking/warning/suggestion; export gate (BR-019) | EP-16 |
| SC-19 | Quality panel | Six-axis scores; low quality = warning | EP-17 |
| SC-20 | Alignment matrix | need→skill→PLO→CLO→unit→content→activity→question | EP-10 |
| SC-21 | Versions | Snapshots, compare, restore (as new version) | EP-19 |
| SC-22 | Audit log | 13-field operation history | EP-19 |
| SC-23 | Export | Gate check → build package → index | EP-21 |
| SC-24 | Publish / update cycle | Lock published; open new cycle (BR-020) | EP-19 |
| SC-25 | Templates | Manage versions + diff + approve | EP-15 |
| SC-26 | Template mapping | Fields ↔ DB ↔ controls (V-06) | EP-15 |
| SC-27 | OpenRouter / LLM settings | Model + encrypted key + connection test | EP-06 |
| SC-28 | Application settings | Flags + general config | EP-01/06 |
| SC-29 | Deleted items | Soft-deleted entities + restore | EP-02/19 |
| SC-30 | Question bank | Balanced generation; each Q linked to CLO | EP-13 |
