import { NextResponse, type NextRequest } from "next/server";
import { createQuestionBank } from "@/services/questionBankService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/question-bank — create a question bank (SC-30).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { title?: string } = {};
  try {
    body = await req.json();
  } catch {
    // default title allowed
  }
  try {
    const bankId = await createQuestionBank(ctx.params.id, body.title ?? "بنك الأسئلة", actor);
    return NextResponse.json({ bankId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
