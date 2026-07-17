import { NextResponse, type NextRequest } from "next/server";
import { buildExportPackage } from "@/services/exportPackageService";
import { ExportBlockedError, JustificationRequiredError } from "@/services/complianceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/:id/export-package — assemble the full submission package. Builds
// ONLY past the compliance gate (BR-019): 409 when blocked, 422 when a justification
// is required, 201 with the index manifest on success.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { templateVersionId?: string; justification?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  if (!body.templateVersionId)
    return NextResponse.json({ error: "معرّف نسخة القالب مطلوب." }, { status: 400 });
  try {
    const result = await buildExportPackage(ctx.params.id, body.templateVersionId, actor, {
      justification: body.justification,
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    if (err instanceof ExportBlockedError) {
      return NextResponse.json({ error: err.message, code: "blocked" }, { status: 409 });
    }
    if (err instanceof JustificationRequiredError) {
      return NextResponse.json(
        { error: err.message, code: "needs_justification" },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
