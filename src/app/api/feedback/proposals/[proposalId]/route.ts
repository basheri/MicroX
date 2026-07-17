import { NextResponse, type NextRequest } from "next/server";
import { applyProposal, rejectProposal, ProposalStateError } from "@/services/feedbackService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/feedback/proposals/:proposalId — apply (after approval) or reject a change
// proposal. Body: { action: "apply" | "reject", reason? }. Apply creates a version.
export async function POST(req: NextRequest, ctx: { params: { proposalId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    if (body.action === "apply") {
      const result = await applyProposal(ctx.params.proposalId, actor);
      return NextResponse.json({ result }, { status: 201 });
    }
    if (body.action === "reject") {
      await rejectProposal(ctx.params.proposalId, actor, body.reason);
      return NextResponse.json({ result: { rejected: true } }, { status: 201 });
    }
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (err) {
    if (err instanceof ProposalStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
