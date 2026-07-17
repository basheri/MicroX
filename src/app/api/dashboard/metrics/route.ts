import { NextResponse } from "next/server";
import { getMetrics } from "@/services/metricsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboard/metrics — real DB aggregations for the dashboard (SC-03).
export async function GET() {
  try {
    const metrics = await getMetrics();
    return NextResponse.json({ metrics });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
