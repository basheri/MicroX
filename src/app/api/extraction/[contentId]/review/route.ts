import { NextResponse, type NextRequest } from "next/server";
import { reviewExtraction } from "@/services/extractionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/extraction/:contentId/review — approve / correct / reject a block (SC-07).
export async function POST(req: NextRequest, ctx: { params: { contentId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });

  let body: { status?: string; correctedContent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  if (body.status !== "approved" && body.status !== "corrected" && body.status !== "rejected") {
    return NextResponse.json({ error: "حالة مراجعة غير صالحة." }, { status: 400 });
  }
  try {
    await reviewExtraction(
      ctx.params.contentId,
      { status: body.status, correctedContent: body.correctedContent ?? null },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
