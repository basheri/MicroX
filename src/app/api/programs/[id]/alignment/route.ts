import { NextResponse, type NextRequest } from "next/server";
import {
  linkAlignment,
  listAlignment,
  detectAlignmentGaps,
  addPLO,
} from "@/services/academicService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/alignment — the matrix + TC-06 gap detectors (SC-20).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const [matrix, gaps] = await Promise.all([
    listAlignment(ctx.params.id),
    detectAlignmentGaps(ctx.params.id),
  ]);
  return NextResponse.json({ matrix, gaps });
}

// POST /api/programs/:id/alignment — { action: "link" | "addPLO", ... }.
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
    if (body.action === "addPLO") {
      const id = await addPLO(ctx.params.id, (body.statement as string) ?? "", actor);
      return NextResponse.json({ ploId: id }, { status: 201 });
    }
    const id = await linkAlignment(
      ctx.params.id,
      {
        competencyId: (body.competencyId as string) ?? null,
        ploId: (body.ploId as string) ?? null,
        cloId: (body.cloId as string) ?? null,
        unitId: (body.unitId as string) ?? null,
        questionId: (body.questionId as string) ?? null,
      },
      actor,
    );
    return NextResponse.json({ alignmentId: id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
