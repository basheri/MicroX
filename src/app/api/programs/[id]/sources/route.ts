import { NextResponse, type NextRequest } from "next/server";
import { uploadSource, InfectedFileError } from "@/services/sourcesService";
import { UploadValidationError, type AllowedMime } from "@/domain/uploadValidation";
import { listProgramFiles } from "@/data/sourcesRepo";
import type { SourceType } from "@/data/sourcesRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/programs/:id/sources — list a program's uploaded files (SC-06).
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return NextResponse.json({ files: await listProgramFiles(ctx.params.id) });
}

// POST /api/programs/:id/sources — multipart upload of an official source file (SC-06).
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب رفع غير صالح." }, { status: 400 });
  }
  const file = form.get("file");
  const sourceType = String(form.get("sourceType") ?? "") as SourceType;
  const notes = form.get("notes") ? String(form.get("notes")) : undefined;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لم يتم إرفاق ملف." }, { status: 400 });
  }

  try {
    const result = await uploadSource(
      {
        programId: ctx.params.id,
        file: {
          originalName: file.name,
          declaredMime: file.type as AllowedMime,
          bytes: new Uint8Array(await file.arrayBuffer()),
        },
        sourceType,
        notes,
      },
      actor,
    );
    return NextResponse.json({ source: result }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof InfectedFileError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
