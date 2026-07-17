import { NextResponse, type NextRequest } from "next/server";
import {
  attemptExport,
  ExportBlockedError,
  JustificationRequiredError,
} from "@/services/complianceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/export — the BR-019 export gate. A blocking failure returns
// 409 (prevented); a low-quality failure without a justification returns 422 asking
// for one; otherwise the export package is created.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { justification?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body -> attempt without a justification
  }
  try {
    const out = await attemptExport(ctx.params.id, actor, { justification: body.justification });
    return NextResponse.json({ result: out }, { status: 201 });
  } catch (err) {
    if (err instanceof ExportBlockedError) {
      return NextResponse.json(
        { error: err.message, code: "blocked", failures: err.failures },
        { status: 409 },
      );
    }
    if (err instanceof JustificationRequiredError) {
      return NextResponse.json(
        { error: err.message, code: "needs_justification", failures: err.failures },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
