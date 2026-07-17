import { NextResponse, type NextRequest } from "next/server";
import {
  addResource,
  addActivity,
  addDesignAsset,
  listActivitiesForLesson,
  listResourcesForLesson,
} from "@/services/contentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/lessons/:lessonId/content — resources + formative activities (SC-16).
export async function GET(_req: NextRequest, ctx: { params: { lessonId: string } }) {
  const [resources, activities] = await Promise.all([
    listResourcesForLesson(ctx.params.lessonId),
    listActivitiesForLesson(ctx.params.lessonId),
  ]);
  return NextResponse.json({ resources, activities });
}

// POST /api/lessons/:lessonId/content — { kind: "resource" | "activity" | "asset", ... }.
export async function POST(req: NextRequest, ctx: { params: { lessonId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const lessonId = ctx.params.lessonId;
  try {
    if (body.kind === "resource") {
      const id = await addResource(
        lessonId,
        {
          resourceType: body.resourceType as string,
          title: body.title as string,
          durationMinutes: body.durationMinutes as number,
        },
        actor,
      );
      return NextResponse.json({ resourceId: id }, { status: 201 });
    }
    if (body.kind === "activity") {
      // Always formative (BR-009) regardless of any client hint.
      const id = await addActivity(lessonId, { title: (body.title as string) ?? "" }, actor);
      return NextResponse.json({ activityId: id, isFormative: true }, { status: 201 });
    }
    if (body.kind === "asset") {
      const id = await addDesignAsset(
        {
          lessonId,
          assetType: (body.assetType as string) ?? "other",
          content: body.content as string,
        },
        actor,
      );
      return NextResponse.json({ assetId: id }, { status: 201 });
    }
    return NextResponse.json({ error: "نوع غير صالح." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
