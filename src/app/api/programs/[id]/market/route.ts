import { NextResponse, type NextRequest } from "next/server";
import {
  createMarketAnalysis,
  generateMarketAnalysis,
  getMarketAnalysis,
} from "@/services/marketAnalysisService";
import { FeasibilityValidationError } from "@/domain/feasibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/market — latest analysis + skills + sources (SC-08).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return NextResponse.json({ market: await getMarketAnalysis(ctx.params.id) });
}

// POST /api/programs/:id/market — generate (action:"generate") or create manually.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    if (body.action === "generate") {
      const id = await generateMarketAnalysis(ctx.params.id, actor);
      return NextResponse.json({ analysisId: id }, { status: 201 });
    }
    const id = await createMarketAnalysis(
      {
        programId: ctx.params.id,
        summary: (body.summary as string) ?? null,
        feasibilityRating: (body.feasibilityRating as string) ?? "",
        justification: (body.justification as string) ?? null,
        skills: (body.skills as never[]) ?? [],
        sources: (body.sources as never[]) ?? [],
      },
      actor,
    );
    return NextResponse.json({ analysisId: id }, { status: 201 });
  } catch (err) {
    const status = err instanceof FeasibilityValidationError ? 422 : 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
