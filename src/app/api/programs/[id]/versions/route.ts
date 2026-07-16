import { NextResponse, type NextRequest } from "next/server";
import {
  getProgramVersions,
  publishProgram,
  openUpdateCycle,
  restoreVersion,
  compareVersions,
  PublishedLockError,
} from "@/services/versioningService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/versions — list snapshots; optional ?compareA=&compareB= diff.
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const a = req.nextUrl.searchParams.get("compareA");
  const b = req.nextUrl.searchParams.get("compareB");
  try {
    if (a && b) {
      const diff = await compareVersions(ctx.params.id, Number(a), Number(b));
      return NextResponse.json({ diff });
    }
    const versions = await getProgramVersions(ctx.params.id);
    return NextResponse.json({ versions });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// POST /api/programs/:id/versions — { action: "publish" | "openCycle" | "restore",
// versionNo? }. Publishing locks the program (BR-020); restore creates a new version.
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { action?: string; versionNo?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    if (body.action === "publish") {
      const versionNo = await publishProgram(ctx.params.id, actor);
      return NextResponse.json({ result: { versionNo } }, { status: 201 });
    }
    if (body.action === "openCycle") {
      const versionNo = await openUpdateCycle(ctx.params.id, actor);
      return NextResponse.json({ result: { versionNo } }, { status: 201 });
    }
    if (body.action === "restore") {
      if (body.versionNo == null)
        return NextResponse.json({ error: "رقم النسخة مطلوب." }, { status: 400 });
      const versionNo = await restoreVersion(ctx.params.id, body.versionNo, actor);
      return NextResponse.json({ result: { versionNo } }, { status: 201 });
    }
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (err) {
    if (err instanceof PublishedLockError) {
      return NextResponse.json({ error: err.message, code: "published_lock" }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
