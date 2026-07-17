// Edge middleware (EP-23 / D-07 / SEC-005). Enforces the IP + Origin allow-list at the
// network edge — the first line of defense compensating for the no-login model. Both
// gates are OFF unless their env var is set, so local/dev is open; production sets
// IP_ALLOWLIST (see DEPLOYMENT.md). Fail-safe: a configured gate DENIES on miss.

import { NextResponse, type NextRequest } from "next/server";
import { configFromEnv, decideAccess, clientIpFromHeaders } from "@/lib/accessControl";

export function middleware(req: NextRequest) {
  const config = configFromEnv();
  // No allow-list configured -> nothing to enforce (dev/local).
  if (config.ipAllowlist.length === 0 && config.originAllowlist.length === 0) {
    return NextResponse.next();
  }
  const decision = decideAccess(
    { ip: clientIpFromHeaders(req.headers), origin: req.headers.get("origin") },
    config,
  );
  if (!decision.allow) {
    return new NextResponse(
      JSON.stringify({ error: "الوصول مقيّد بشبكة العمادة (قائمة العناوين المسموح بها)." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  return NextResponse.next();
}

// Apply to everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
