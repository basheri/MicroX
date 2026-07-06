import { NextResponse, type NextRequest } from "next/server";
import { addQuestion, evaluateBankBalance } from "@/services/questionBankService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/question-banks/:bankId — balance report (TC-07 warnings + block).
export async function GET(_req: NextRequest, ctx: { params: { bankId: string } }) {
  return NextResponse.json(await evaluateBankBalance(ctx.params.bankId));
}

// POST /api/question-banks/:bankId — add a question.
export async function POST(req: NextRequest, ctx: { params: { bankId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const questionId = await addQuestion(
      ctx.params.bankId,
      {
        stem: (body.stem as string) ?? "",
        qtype: (body.qtype as string) ?? "mcq",
        cloId: (body.cloId as string) ?? null,
        difficulty: (body.difficulty as "easy" | "medium" | "hard") ?? null,
        options: (body.options as { text: string; isCorrect: boolean }[]) ?? [],
      },
      actor,
    );
    return NextResponse.json({ questionId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
