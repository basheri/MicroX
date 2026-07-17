import { NextResponse } from "next/server";
import { listSectors, listFields, listDevelopmentPaths } from "@/data/lookupsRepo";

export const runtime = "nodejs";
// DB-backed — must run per request, never prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/lookups — sectors, fields, and development paths for filters/forms (EP-03).
export async function GET() {
  const [sectors, fields, developmentPaths] = await Promise.all([
    listSectors(),
    listFields(),
    listDevelopmentPaths(),
  ]);
  return NextResponse.json({ sectors, fields, developmentPaths });
}
