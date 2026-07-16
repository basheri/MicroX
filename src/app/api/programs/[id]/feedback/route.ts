import { NextResponse, type NextRequest } from "next/server";
import { getFeedbackItems, getProposals, proposeChange } from "@/services/feedbackService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/feedback — items + proposals for the program.
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const [items, proposals] = await Promise.all([
      getFeedbackItems(ctx.params.id),
      getProposals(ctx.params.id),
    ]);
    return NextResponse.json({ items, proposals });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// POST /api/programs/:id/feedback — create a PREVIEW change proposal (before/after).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: {
    feedbackItemId?: string;
    sectionRef?: string;
    oldText?: string;
    newText?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  if (!body.newText?.trim())
    return NextResponse.json({ error: "النص الجديد مطلوب." }, { status: 400 });
  try {
    const proposalId = await proposeChange(
      ctx.params.id,
      {
        feedbackItemId: body.feedbackItemId ?? null,
        sectionRef: body.sectionRef ?? null,
        oldText: body.oldText ?? null,
        newText: body.newText,
        reason: body.reason ?? null,
      },
      actor,
    );
    return NextResponse.json({ result: { proposalId } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
