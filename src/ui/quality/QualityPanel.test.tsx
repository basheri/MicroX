import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QualityPanel } from "@/ui/quality/QualityPanel";
import { setActorName } from "@/lib/actor";

describe("QualityPanel (SC-19 / EP-17)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows the advisory note, overall score, per-axis scores, and warnings", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 201,
      json: async () => ({
        result: {
          overall: 72,
          blocksExport: false,
          warnings: [{ key: "plo_coverage" }],
          axes: [
            {
              key: "plo_coverage",
              label: "تغطية مخرجات البرنامج (PLO)",
              kind: "deterministic",
              weight: 0.2,
              score: 50,
              confidence: null,
              isWarning: true,
              insufficientData: false,
              evidence: ["1 من 2 مخرج برنامج غير مغطّى بالمواءمة."],
            },
            {
              key: "outcome_clarity",
              label: "وضوح صياغة المخرجات",
              kind: "llm_assist",
              weight: 0.1,
              score: 80,
              confidence: "medium",
              isWarning: false,
              insufficientData: false,
              evidence: ["واضحة"],
            },
          ],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<QualityPanel programId="p1" />);

    // Advisory / non-blocking note is shown.
    expect(screen.getByRole("note")).toHaveTextContent("لا تمنع التصدير");

    await userEvent.click(screen.getByRole("button", { name: "تقييم الجودة" }));

    // Overall + a warning axis (role=alert) + confidence for the LLM axis.
    expect(await screen.findByText(/النتيجة الإجمالية/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تغطية مخرجات البرنامج");
    expect(screen.getByText(/ثقة: متوسطة/)).toBeInTheDocument();
  });
});
