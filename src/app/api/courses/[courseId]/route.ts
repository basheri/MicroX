import { NextResponse, type NextRequest } from "next/server";
import { editCourse, removeCourse, addCLO, addUnit } from "@/services/academicService";
import { ProgramRuleError } from "@/services/programService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/courses/:courseId — edit title/creditHours (BR-003 enforced).
export async function PATCH(req: NextRequest, ctx: { params: { courseId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { title?: string; creditHours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    await editCourse(
      ctx.params.courseId,
      {
        title: body.title,
        creditHours: body.creditHours !== undefined ? Number(body.creditHours) : undefined,
      },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProgramRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// DELETE /api/courses/:courseId — soft delete.
export async function DELETE(req: NextRequest, ctx: { params: { courseId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  await removeCourse(ctx.params.courseId, actor);
  return NextResponse.json({ ok: true });
}

// POST /api/courses/:courseId — add a child: { kind: "clo" | "unit", ... }.
export async function POST(req: NextRequest, ctx: { params: { courseId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { kind?: string; statement?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    if (body.kind === "clo") {
      const id = await addCLO(ctx.params.courseId, body.statement ?? "", actor);
      return NextResponse.json({ cloId: id }, { status: 201 });
    }
    if (body.kind === "unit") {
      const id = await addUnit(ctx.params.courseId, body.title ?? "", actor);
      return NextResponse.json({ unitId: id }, { status: 201 });
    }
    return NextResponse.json({ error: "نوع غير صالح." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
