import { exportMetricsXlsx } from "@/services/metricsService";
import { XLSX_MIME } from "@/services/xlsx/xlsxWriter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dashboard/export — download the metrics as dashboard/export.xlsx.
export async function GET() {
  try {
    const bytes = await exportMetricsXlsx();
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": 'attachment; filename="dashboard-export.xlsx"',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
