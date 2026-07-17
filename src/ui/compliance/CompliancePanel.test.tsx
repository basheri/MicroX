import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompliancePanel } from "@/ui/compliance/CompliancePanel";
import { setActorName } from "@/lib/actor";

describe("CompliancePanel (SC-18 / BR-019)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("runs checks, shows the low-quality gate, and exports with a saved justification", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/compliance")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            result: {
              decision: "needs_justification",
              results: [
                { ruleCode: "COMP-BR-001", severity: "blocking", passed: true, message: "" },
                {
                  ruleCode: "COMP-QUALITY-REFERENCES",
                  severity: "warning",
                  passed: false,
                  message: "يُفضّل مرجع موثّق واحد على الأقل.",
                },
              ],
            },
          }),
        };
      }
      // /export
      return {
        ok: true,
        status: 201,
        json: async () => ({ result: { decision: "needs_justification" } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<CompliancePanel programId="p1" />);

    // V-05 placeholder + editable-rules notice is shown.
    expect(screen.getByRole("note")).toHaveTextContent("V-05");

    await userEvent.click(screen.getByRole("button", { name: "فحص التوافق" }));

    // The warning failure is surfaced (low quality does not block).
    expect(await screen.findByText(/جودة منخفضة/)).toBeInTheDocument();
    expect(screen.getByText(/COMP-QUALITY-REFERENCES/)).toBeInTheDocument();

    // Justification field appears for a low-quality decision; export sends it.
    await userEvent.type(screen.getByLabelText("تبرير التصدير"), "اعتمد يدويًا");
    await userEvent.click(screen.getByRole("button", { name: "تصدير الحزمة" }));

    expect(await screen.findByText("تم إنشاء حزمة التصدير ✓")).toBeInTheDocument();
    const exportCall = calls.find((c) => c.url.endsWith("/export"))!;
    expect(JSON.parse(exportCall.init!.body as string).justification).toBe("اعتمد يدويًا");
  });
});
