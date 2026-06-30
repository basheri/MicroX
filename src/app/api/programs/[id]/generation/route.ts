import { NextResponse, type NextRequest } from "next/server";
import { startGeneration, getGenerationState } from "@/services/generationService";
import { MarketAnalysisNotApprovedError } from "@/services/marketAnalysisService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/generation — current generated sections (previews/applied).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return NextResponse.json(await getGenerationState(ctx.params.id));
}

// POST /api/programs/:id/generation — enqueue a generation job (the worker runs it).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { jobType?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body allowed
  }
  try {
    const jobId = await startGeneration(ctx.params.id, { jobType: body.jobType }, actor);
    return NextResponse.json({ jobId }, { status: 201 });
  } catch (err) {
    if (err instanceof MarketAnalysisNotApprovedError) {
      return NextResponse.json(
        { error: err.message, code: "market_not_approved" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
