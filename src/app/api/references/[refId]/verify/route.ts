import { NextResponse, type NextRequest } from "next/server";
import { verifyReference } from "@/services/referenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/references/:refId/verify — check existence; flags it if unverifiable (AI-004).
export async function POST(req: NextRequest, ctx: { params: { refId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    const ref = await verifyReference(ctx.params.refId, actor);
    return NextResponse.json({ reference: ref });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
