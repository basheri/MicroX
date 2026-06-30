import { NextResponse, type NextRequest } from "next/server";
import { impactAnalysis } from "@/services/generationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/impact — { changedSectionKey }. READ-ONLY: lists affected
// sections, applies nothing.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  let body: { changedSectionKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const report = await impactAnalysis(ctx.params.id, body.changedSectionKey ?? "");
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
