// Structured logging (EP-24). Emits single-line JSON so logs are queryable in Vercel /
// any aggregator, carries a request_id for correlation, and REDACTS sensitive fields so
// secrets/PII never reach the logs (SEC-006 / SEC-008). Framework-free + testable.

export type LogLevel = "debug" | "info" | "warn" | "error";

// Keys whose values must never be logged in full (secrets + PII).
const SENSITIVE_KEY =
  /(api[_-]?key|authorization|token|secret|password|encryption|national_id|email|phone)/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  return value;
}

// Deep-redact an object's sensitive fields (bounded depth to avoid cycles blowing up).
export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export interface LogRecord {
  level: LogLevel;
  msg: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogSink {
  write(line: string): void;
}

const consoleSink: LogSink = {
  write: (line) => {
    // eslint-disable-next-line no-console
    console.log(line);
  },
};

// Build the JSON log line (no timestamp here — the platform adds ingestion time, and
// Date is intentionally avoided so this stays pure/testable).
export function formatLog(record: LogRecord): string {
  const safe = redact(record) as Record<string, unknown>;
  return JSON.stringify(safe);
}

export function log(record: LogRecord, sink: LogSink = consoleSink): void {
  sink.write(formatLog(record));
}

export const logger = {
  info: (msg: string, meta: Record<string, unknown> = {}, sink?: LogSink) =>
    log({ level: "info", msg, ...meta }, sink),
  warn: (msg: string, meta: Record<string, unknown> = {}, sink?: LogSink) =>
    log({ level: "warn", msg, ...meta }, sink),
  error: (msg: string, meta: Record<string, unknown> = {}, sink?: LogSink) =>
    log({ level: "error", msg, ...meta }, sink),
};
