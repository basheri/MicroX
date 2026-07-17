import { NextResponse, type NextRequest } from "next/server";
import { approveMarketAnalysis } from "@/services/marketAnalysisService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/market/:analysisId/approve — human approval (AI-006); unblocks generation.
export async function POST(req: NextRequest, ctx: { params: { analysisId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    await approveMarketAnalysis(ctx.params.analysisId, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
