import { NextResponse, type NextRequest } from "next/server";
import { addCourse, listCourses, validateProgramCourses } from "@/services/academicService";
import { ProgramRuleError } from "@/services/programService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/courses — list courses + BR-001/BR-002 structure issues (SC-11/13).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const [courses, issues] = await Promise.all([
    listCourses(ctx.params.id),
    validateProgramCourses(ctx.params.id),
  ]);
  return NextResponse.json({ courses, issues });
}

// POST /api/programs/:id/courses — add a course (BR-003 + BR-001 upper bound enforced).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { title?: string; creditHours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const courseId = await addCourse(
      ctx.params.id,
      { title: body.title ?? "", creditHours: Number(body.creditHours) },
      actor,
    );
    return NextResponse.json({ courseId }, { status: 201 });
  } catch (err) {
    if (err instanceof ProgramRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
