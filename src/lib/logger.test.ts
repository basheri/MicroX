import { describe, it, expect } from "vitest";
import { formatLog, redact, redactValue, logger, type LogSink } from "@/lib/logger";

describe("logger (EP-24) — structured + sensitive-data-safe", () => {
  it("emits single-line JSON with the level and message", () => {
    const line = formatLog({ level: "info", msg: "hello", requestId: "r1" });
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.requestId).toBe("r1");
    expect(line).not.toContain("\n");
  });

  it("REDACTS secrets and PII by key (SEC-006/008)", () => {
    expect(redactValue("api_key", "sk-123")).toBe("[redacted]");
    expect(redactValue("authorization", "Bearer x")).toBe("[redacted]");
    expect(redactValue("email", "a@b.com")).toBe("[redacted]");
    expect(redactValue("stage", "new")).toBe("new");
  });

  it("deep-redacts nested sensitive fields", () => {
    const out = redact({
      user: { email: "a@b.com", name: "منى" },
      settings: { openrouter_api_key: "sk-secret" },
    }) as Record<string, Record<string, unknown>>;
    expect(out.user!.email).toBe("[redacted]");
    expect(out.user!.name).toBe("منى");
    expect(out.settings!.openrouter_api_key).toBe("[redacted]");
  });

  it("never lets a secret reach the sink", () => {
    const lines: string[] = [];
    const sink: LogSink = { write: (l) => lines.push(l) };
    logger.error("llm call failed", { api_key: "sk-should-not-appear", model: "x" }, sink);
    expect(lines[0]).not.toContain("sk-should-not-appear");
    expect(lines[0]).toContain("[redacted]");
    expect(lines[0]).toContain('"model":"x"');
  });
});
