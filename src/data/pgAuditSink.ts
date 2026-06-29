// Postgres-backed audit sink (EP-02). Replaces the EP-01 in-memory sink: every
// audited write is persisted to the append-only `audit_logs` table (rule 30).
// Wire it into withAudit() from the service layer.

import type { PoolClient } from "pg";
import type { AuditEntry, AuditSink } from "@/lib/audit";
import { getPool } from "@/data/pool";

export class PgAuditSink implements AuditSink {
  // Optional client so a write + its audit row can share one transaction.
  constructor(private readonly client?: PoolClient) {}

  async record(entry: AuditEntry): Promise<void> {
    const runner = this.client ?? getPool();
    await runner.query(
      `insert into audit_logs
         (actor_name, operation_type, program_id, section_ref, old_value, new_value,
          change_reason, override_justification, llm_model, operation_status, version_no, request_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        entry.actor_name,
        entry.operation_type,
        entry.program_id ?? null,
        entry.section_ref ?? null,
        entry.old_value ?? null,
        entry.new_value ?? null,
        entry.change_reason ?? null,
        entry.override_justification ?? null,
        entry.llm_model ?? null,
        entry.operation_status ?? null,
        entry.version_no ?? null,
        entry.request_id ?? null,
      ],
    );
  }
}
