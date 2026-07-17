import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionBankPanel } from "@/ui/questions/QuestionBankPanel";

describe("QuestionBankPanel (SC-30 / TC-07)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the bank as blocked with the unlinked-question issue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          balanced: false,
          issues: [
            {
              code: "question_unlinked",
              severity: "warning",
              message: "سؤال غير مرتبط بمخرج تعلم (CLO).",
              questionId: "q1",
            },
            {
              code: "balance_unlinked",
              severity: "blocking",
              message: "تعذّر اعتماد توازن البنك: يوجد 1 سؤال غير مرتبط بمخرج تعلم (§17).",
            },
          ],
        }),
      })) as unknown as typeof fetch,
    );

    render(<QuestionBankPanel bankId="b1" />);

    expect(await screen.findByText(/غير متوازن \(محجوب\)/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر اعتماد توازن البنك");
    expect(screen.getByText("سؤال غير مرتبط بمخرج تعلم (CLO).")).toBeInTheDocument();
  });

  it("shows a balanced bank", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ balanced: true, issues: [] }),
      })) as unknown as typeof fetch,
    );
    render(<QuestionBankPanel bankId="b1" />);
    expect(await screen.findByText(/متوازن/)).toBeInTheDocument();
  });
});
