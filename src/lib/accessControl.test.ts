import { describe, it, expect } from "vitest";
import {
  decideAccess,
  ipMatches,
  parseList,
  configFromEnv,
  clientIpFromHeaders,
} from "@/lib/accessControl";

describe("accessControl (D-07 / SEC-005) — IP + Origin allow-list", () => {
  it("matches exact IPv4 and CIDR ranges (and rejects outside)", () => {
    expect(ipMatches("10.1.2.3", "10.1.2.3")).toBe(true);
    expect(ipMatches("10.1.2.3", "10.0.0.0/8")).toBe(true);
    expect(ipMatches("11.0.0.1", "10.0.0.0/8")).toBe(false);
    expect(ipMatches("192.168.1.50", "192.168.1.0/24")).toBe(true);
    expect(ipMatches("192.168.2.50", "192.168.1.0/24")).toBe(false);
    expect(ipMatches("not-an-ip", "10.0.0.0/8")).toBe(false);
  });

  it("does NOT enforce when no allow-list is configured (dev/local open)", () => {
    const d = decideAccess(
      { ip: "1.2.3.4", origin: null },
      { ipAllowlist: [], originAllowlist: [] },
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("not_enforced");
  });

  it("DENIES an IP outside a configured allow-list (fail-safe)", () => {
    const cfg = { ipAllowlist: ["10.0.0.0/8"], originAllowlist: [] };
    expect(decideAccess({ ip: "10.5.5.5", origin: null }, cfg).allow).toBe(true);
    const denied = decideAccess({ ip: "8.8.8.8", origin: null }, cfg);
    expect(denied.allow).toBe(false);
    expect(denied.reason).toBe("ip_not_allowlisted");
  });

  it("DENIES a missing IP when the IP gate is enforced", () => {
    const cfg = { ipAllowlist: ["10.0.0.0/8"], originAllowlist: [] };
    expect(decideAccess({ ip: null, origin: null }, cfg).allow).toBe(false);
  });

  it("enforces the origin gate only for requests that carry an Origin", () => {
    const cfg = { ipAllowlist: [], originAllowlist: ["https://microx.kau.edu.sa"] };
    expect(decideAccess({ ip: null, origin: "https://evil.example" }, cfg).allow).toBe(false);
    expect(decideAccess({ ip: null, origin: "https://microx.kau.edu.sa" }, cfg).allow).toBe(true);
    // No Origin header (server-to-server / same-origin) is not blocked by this gate.
    expect(decideAccess({ ip: null, origin: null }, cfg).allow).toBe(true);
  });

  it("parses env lists and resolves the client IP from proxy headers", () => {
    expect(parseList("a, b ,,c")).toEqual(["a", "b", "c"]);
    expect(configFromEnv({ IP_ALLOWLIST: "10.0.0.0/8" }).ipAllowlist).toEqual(["10.0.0.0/8"]);
    const headers = new Map([["x-forwarded-for", "203.0.113.9, 10.0.0.1"]]);
    expect(clientIpFromHeaders({ get: (n) => headers.get(n) ?? null })).toBe("203.0.113.9");
  });
});
