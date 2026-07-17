import { describe, it, expect } from "vitest";
import { withAudit, InMemoryAuditSink } from "@/lib/audit";

describe("audit wrapper (rule 00 / rule 30)", () => {
  it("records a success entry attributed to the actor", async () => {
    const sink = new InMemoryAuditSink();
    const result = await withAudit(
      { actor_name: "منى", operation_type: "create_program" },
      async () => "ok",
      sink,
    );
    expect(result).toBe("ok");
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]).toMatchObject({
      actor_name: "منى",
      operation_type: "create_program",
      operation_status: "success",
    });
  });

  it("records an error entry and rethrows when the write fails", async () => {
    const sink = new InMemoryAuditSink();
    await expect(
      withAudit(
        { actor_name: "منى", operation_type: "update" },
        async () => {
          throw new Error("boom");
        },
        sink,
      ),
    ).rejects.toThrow("boom");
    expect(sink.entries[0]?.operation_status).toBe("error");
  });

  it("refuses anonymous writes (no actor_name)", async () => {
    const sink = new InMemoryAuditSink();
    await expect(
      withAudit({ actor_name: "", operation_type: "x" }, async () => 1, sink),
    ).rejects.toThrow(/actor_name is required/);
    expect(sink.entries).toHaveLength(0);
  });
});
