import { NextResponse, type NextRequest } from "next/server";
import { testConnection } from "@/services/llmSettingsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/settings/llm/test — mandatory connection test (AI-007). Uses the configured
// provider (real OpenRouter in production); returns a clear pass/fail message.
export async function POST(req: NextRequest) {
  const actor = (req.headers.get("x-actor-name") ?? "").trim();
  if (!actor) return NextResponse.json({ error: "الاسم مطلوب لتسجيل العملية." }, { status: 401 });
  const result = await testConnection(actor);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
