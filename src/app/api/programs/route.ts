import { NextResponse, type NextRequest } from "next/server";
import { createProgram, listPrograms } from "@/services/programService";

export const runtime = "nodejs";
// DB-backed — must run per request, never prerendered at build time.
export const dynamic = "force-dynamic";

// Reads the actor name from a header (set from the localStorage actor_name, rule 00).
function actorFrom(req: NextRequest): string {
  return (req.headers.get("x-actor-name") ?? "").trim();
}

// GET /api/programs — dashboard list with optional filters (SC-03).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const programs = await listPrograms({
    sectorId: q.get("sectorId") ?? undefined,
    fieldId: q.get("fieldId") ?? undefined,
    developmentPathId: q.get("developmentPathId") ?? undefined,
    stage: q.get("stage") ?? undefined,
    approvalState: q.get("approvalState") ?? undefined,
    search: q.get("search") ?? undefined,
  });
  return NextResponse.json({ programs });
}

// POST /api/programs — create from name + sector + field only (SC-02, no cloning).
export async function POST(req: NextRequest) {
  const actor = actorFrom(req);
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { name?: string; sectorId?: string; fieldId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const program = await createProgram(
      { name: body.name ?? "", sectorId: body.sectorId ?? "", fieldId: body.fieldId ?? "" },
      actor,
    );
    return NextResponse.json({ program }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
