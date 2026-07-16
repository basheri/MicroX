// Edge access control (EP-23 / D-07 / SEC-005) — the first line of defense that
// compensates for the no-login model (risk R-01). PURE and framework-free so it is
// unit-testable; the Next.js middleware is a thin wrapper over decideAccess().
//
// Two independent gates, both env-driven and OFF by default (so local/dev is open):
//   - IP allow-list  (IP_ALLOWLIST): comma-separated IPv4 addresses or CIDR ranges.
//   - Origin allow-list (ORIGIN_ALLOWLIST): comma-separated exact origins.
// When a list is set, requests failing it are DENIED (fail-safe). When empty, that gate
// is not enforced — production MUST set IP_ALLOWLIST (documented in DEPLOYMENT.md).

export interface AccessConfig {
  ipAllowlist: string[]; // IPv4 or CIDR (e.g. "10.0.0.0/8")
  originAllowlist: string[]; // exact origins (e.g. "https://microx.kau.edu.sa")
}

export interface AccessRequest {
  ip: string | null; // resolved client IP (first x-forwarded-for hop)
  origin: string | null; // Origin header
}

export interface AccessDecision {
  allow: boolean;
  reason: string;
  enforcedIp: boolean;
  enforcedOrigin: boolean;
}

export function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): AccessConfig {
  return {
    ipAllowlist: parseList(env.IP_ALLOWLIST),
    originAllowlist: parseList(env.ORIGIN_ALLOWLIST),
  };
}

// Parse an IPv4 dotted-quad to a 32-bit unsigned integer, or null if malformed.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

// Does an IPv4 address fall within an allow-list entry (exact IP or CIDR)?
export function ipMatches(ip: string, entry: string): boolean {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  if (entry.includes("/")) {
    const [base, bitsRaw] = entry.split("/");
    const baseInt = ipv4ToInt(base ?? "");
    const bits = Number(bitsRaw);
    if (baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (baseInt & mask);
  }
  const entryInt = ipv4ToInt(entry);
  return entryInt !== null && entryInt === addr;
}

export function decideAccess(req: AccessRequest, config: AccessConfig): AccessDecision {
  const enforcedIp = config.ipAllowlist.length > 0;
  const enforcedOrigin = config.originAllowlist.length > 0;

  // IP gate (first line of defense — highest impact).
  if (enforcedIp) {
    if (!req.ip || !config.ipAllowlist.some((e) => ipMatches(req.ip!, e))) {
      return {
        allow: false,
        reason: "ip_not_allowlisted",
        enforcedIp,
        enforcedOrigin,
      };
    }
  }

  // Origin gate (defense in depth for browser requests). A request with no Origin
  // (server-to-server, same-origin navigations) is not blocked by this gate.
  if (enforcedOrigin && req.origin && !config.originAllowlist.includes(req.origin)) {
    return { allow: false, reason: "origin_not_allowlisted", enforcedIp, enforcedOrigin };
  }

  return {
    allow: true,
    reason: enforcedIp || enforcedOrigin ? "allowlisted" : "not_enforced",
    enforcedIp,
    enforcedOrigin,
  };
}

// Resolve the client IP from proxy headers (Vercel sets x-forwarded-for).
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}
