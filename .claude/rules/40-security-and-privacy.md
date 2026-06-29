# 40 — Security & Privacy (SEC-001..008)

- **SEC-001** TLS in transit; encryption at rest (Supabase).
- **SEC-002** OpenRouter API key encrypted server-side; never returned in full after save (masked).
- **SEC-003** API hardening: strict input validation, parameterized queries (no SQL injection), output encoding (no XSS), CSRF token.
- **SEC-004** Safe upload: type allow-list (PDF/DOCX/XLSX), real-MIME check, size limit, malware scan, storage outside app root.
- **SEC-005** Edge protection: per-IP rate limiting, non-blocking bot protection, Origin allow-list.
- **SEC-006** Redaction pipeline removes names/IDs/emails/phones before any model call; logged in `redaction_logs`.
- **SEC-007** Storage links are short-lived Signed URLs only; no permanent public URLs.
- **SEC-008** Soft delete + full audit trail + secrets via Vercel environment variables.

## No-login compensations (the key risk, R-01)
Anyone with the link has full permissions and cannot be revoked individually. Compensate without harming UX:
1. **IP allow-list** at the Vercel/network layer for the Deanship network (first line of defense — highest impact).
2. Unguessable, **rotatable** link.
3. Mandatory `actor_name` + complete audit of every operation.
4. Soft delete + versions + restore to neutralize any tampering.

Treat #1 (IP allow-list) as required, not optional.
