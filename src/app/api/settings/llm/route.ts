import { NextResponse, type NextRequest } from "next/server";
import { getMaskedSettings, saveSettings } from "@/services/llmSettingsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/settings/llm — current model + MASKED key (never the full key, SEC-002).
export async function GET() {
  return NextResponse.json(await getMaskedSettings());
}

// PUT /api/settings/llm — set the active model and (optionally) a new key (SC-27).
export async function PUT(req: NextRequest) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  let body: { modelId?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const settings = await saveSettings(
      { modelId: body.modelId ?? "", apiKey: body.apiKey },
      actor,
    );
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
