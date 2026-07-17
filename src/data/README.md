# `data/` — persistence & storage layer

Supabase clients and repositories (rule 30-database-and-data). All queries are
parameterized (SEC-003); default reads exclude `is_deleted = true` (soft delete);
files live in a private bucket served only via short-lived Signed URLs (SEC-007).

EP-01 ships only the **env contract** (`env.ts`) and this boundary. The real
Supabase client, repositories, RLS, and storage helpers are built in EP-02.
