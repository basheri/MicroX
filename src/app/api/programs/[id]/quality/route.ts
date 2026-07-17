import { NextResponse, type NextRequest } from "next/server";
import { assessProgramQuality, getProgramQuality } from "@/services/qualityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/quality — the latest persisted six-axis assessment (SC-19).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const axes = await getProgramQuality(ctx.params.id);
    return NextResponse.json({ axes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// POST /api/programs/:id/quality — run the quality engine. Advisory only (BR-019):
// results never block export.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    const result = await assessProgramQuality(ctx.params.id, actor);
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
