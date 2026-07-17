import { NextResponse, type NextRequest } from "next/server";
import { recomputeHours, setSchedule } from "@/services/schedulingService";
import { ProgramRuleError } from "@/services/programService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/schedule — LIVE recompute (totals + weekly load + violations).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return NextResponse.json(await recomputeHours(ctx.params.id));
}

// POST /api/programs/:id/schedule — { weeks }. BR-005 blocks weekly load > 15.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { weeks?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const schedule = await setSchedule(ctx.params.id, Number(body.weeks), actor);
    return NextResponse.json({ schedule });
  } catch (err) {
    if (err instanceof ProgramRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
