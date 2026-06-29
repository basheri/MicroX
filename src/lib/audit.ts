// Audit contract (rule 00 / rule 30 / SC-22). Every write is attributed to `actor_name`
// and recorded in `audit_logs` (the 13-field shape below mirrors db/schema.sql).
//
// EP-01 provides the typed contract + a `withAudit` wrapper with an in-memory sink.
// EP-02 swaps the sink for a Supabase insert into `audit_logs`. Callers (the service
// layer) do not change when that happens.

export interface AuditEntry {
  actor_name: string;
  operation_type: string;
  program_id?: string | null;
  section_ref?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  change_reason?: string | null;
  override_justification?: string | null;
  llm_model?: string | null;
  operation_status?: string | null;
  version_no?: number | null;
  request_id?: string | null;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

// Default in-memory sink for EP-01 and tests. Replaced by a DB-backed sink in EP-02.
export class InMemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export const auditSink: AuditSink = new InMemoryAuditSink();

// Wrap a write so it is always attributed and audited. Throws if no actor is set —
// there is no anonymous write path (rule 00).
export async function withAudit<T>(
  meta: Omit<AuditEntry, "operation_status">,
  write: () => Promise<T>,
  sink: AuditSink = auditSink,
): Promise<T> {
  if (!meta.actor_name || meta.actor_name.trim().length === 0) {
    throw new Error("withAudit: actor_name is required — no anonymous writes (rule 00).");
  }
  try {
    const result = await write();
    await sink.record({ ...meta, operation_status: "success" });
    return result;
  } catch (err) {
    await sink.record({ ...meta, operation_status: "error" });
    throw err;
  }
}
