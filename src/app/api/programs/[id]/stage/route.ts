import { NextResponse, type NextRequest } from "next/server";
import { advanceStage, setStage, ProgramRuleError } from "@/services/programService";

export const runtime = "nodejs";
// DB-backed — must run per request, never prerendered at build time.
export const dynamic = "force-dynamic";

// POST /api/programs/:id/stage — advance one stage, or jump to {target} if given (SC-05).
// Returns 409 with Arabic rule messages when a structure gate (BR-001/BR-002) blocks it.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });

  let target: string | undefined;
  try {
    const body = await req.json();
    target = body?.target;
  } catch {
    // no body — plain advance
  }

  try {
    const program = target
      ? await setStage(ctx.params.id, target, actor)
      : await advanceStage(ctx.params.id, actor);
    return NextResponse.json({ program });
  } catch (err) {
    if (err instanceof ProgramRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
