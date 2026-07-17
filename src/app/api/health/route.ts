import { NextResponse } from "next/server";
import { getHealth } from "@/services/healthService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness of critical dependencies + operational failure signals.
// Returns 503 when a critical component is down so uptime monitors can alert.
export async function GET() {
  try {
    const report = await getHealth();
    return NextResponse.json(report, { status: report.ok ? 200 : 503 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
