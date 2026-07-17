import { NextResponse, type NextRequest } from "next/server";
import { registerTemplate } from "@/services/templateService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/template — register the (placeholder) Word template and return
// its version id, so the export flow has a template version to fill (EP-15/EP-21).
// V-01/V-06: the real official template replaces src/config/templateConfig with no
// change here.
export async function POST(req: NextRequest, _ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    const { templateId, versionId } = await registerTemplate({ name: "قالب البرنامج" }, actor);
    return NextResponse.json({ result: { templateId, versionId } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
