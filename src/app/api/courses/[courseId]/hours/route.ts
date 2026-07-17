import { NextResponse, type NextRequest } from "next/server";
import { setCourseHourAllocations, listHourAllocations } from "@/services/schedulingService";
import { ProgramRuleError } from "@/services/programService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/courses/:courseId/hours — current hour allocations.
export async function GET(_req: NextRequest, ctx: { params: { courseId: string } }) {
  return NextResponse.json({ allocations: await listHourAllocations(ctx.params.courseId) });
}

// POST /api/courses/:courseId/hours — { allocations }. BR-006 blocks if the distribution
// does not sum to credit_hours × 15.
export async function POST(req: NextRequest, ctx: { params: { courseId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { allocations?: { unitId?: string; hours: number; category?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    await setCourseHourAllocations(ctx.params.courseId, body.allocations ?? [], actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProgramRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
