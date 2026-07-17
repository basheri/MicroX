import { NextResponse, type NextRequest } from "next/server";
import { cancelGenerationJob } from "@/services/generationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/generation/:jobId/cancel — cancel a queued/running job.
export async function POST(req: NextRequest, ctx: { params: { jobId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    await cancelGenerationJob(ctx.params.jobId, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
