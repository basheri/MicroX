import { NextResponse, type NextRequest } from "next/server";
import { generateProgramDocument } from "@/services/templateService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/document — fill the original template for the program (SC-23/25).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { versionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  if (!body.versionId)
    return NextResponse.json({ error: "معرّف نسخة القالب مطلوب." }, { status: 400 });
  try {
    const result = await generateProgramDocument(ctx.params.id, body.versionId, actor);
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
