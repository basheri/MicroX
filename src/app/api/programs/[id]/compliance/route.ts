import { NextResponse, type NextRequest } from "next/server";
import { runComplianceChecks, getComplianceChecks } from "@/services/complianceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/compliance — the latest persisted checks (SC-19).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const checks = await getComplianceChecks(ctx.params.id);
    return NextResponse.json({ checks });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// POST /api/programs/:id/compliance — run the data-driven rules engine (BR-019).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    const run = await runComplianceChecks(ctx.params.id, actor);
    return NextResponse.json({ result: run }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
