import { NextResponse, type NextRequest } from "next/server";
import {
  extractStoredFile,
  listExtraction,
  OcrNotConfiguredError,
} from "@/services/extractionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files/:fileId/extraction — list extracted blocks with gate flags (SC-07).
export async function GET(_req: NextRequest, ctx: { params: { fileId: string } }) {
  return NextResponse.json({ blocks: await listExtraction(ctx.params.fileId) });
}

// POST /api/files/:fileId/extraction — run extraction (downloads the file from storage).
export async function POST(req: NextRequest, ctx: { params: { fileId: string } }) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  try {
    const summary = await extractStoredFile(ctx.params.fileId, actor);
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    if (err instanceof OcrNotConfiguredError) {
      return NextResponse.json({ error: err.message, code: "ocr_not_configured" }, { status: 501 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
