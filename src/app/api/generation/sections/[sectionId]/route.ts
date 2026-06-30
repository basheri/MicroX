import { NextResponse, type NextRequest } from "next/server";
import { applyGeneratedSection, pinGeneratedSection } from "@/services/generationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/generation/sections/:sectionId — { action: "apply" | "pin" | "unpin" }.
// Applying a section is explicit and only happens here, after a preview (no silent writes).
export async function POST(req: NextRequest, ctx: { params: { sectionId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    if (body.action === "apply") await applyGeneratedSection(ctx.params.sectionId, actor);
    else if (body.action === "pin") await pinGeneratedSection(ctx.params.sectionId, true, actor);
    else if (body.action === "unpin") await pinGeneratedSection(ctx.params.sectionId, false, actor);
    else return NextResponse.json({ error: "إجراء غير صالح." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
