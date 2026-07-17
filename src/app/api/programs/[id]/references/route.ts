import { NextResponse, type NextRequest } from "next/server";
import { addReference, listReferences } from "@/services/referenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/references?language=ar&verified=true — filtered list (SC-17).
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const q = req.nextUrl.searchParams;
  const language = q.get("language") ?? undefined;
  const verifiedParam = q.get("verified");
  const references = await listReferences(ctx.params.id, {
    language,
    verified: verifiedParam === null ? undefined : verifiedParam === "true",
  });
  return NextResponse.json({ references });
}

// POST /api/programs/:id/references — add a reference (starts unverified).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { citation?: string; language?: "ar" | "en"; refType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const refId = await addReference(
      ctx.params.id,
      { citation: body.citation ?? "", language: body.language, refType: body.refType },
      actor,
    );
    return NextResponse.json({ refId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
