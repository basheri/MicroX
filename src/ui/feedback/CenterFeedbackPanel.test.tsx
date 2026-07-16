import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CenterFeedbackPanel } from "@/ui/feedback/CenterFeedbackPanel";
import { setActorName } from "@/lib/actor";

describe("CenterFeedbackPanel (EP-18)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows before/after previews and applies a proposal, reporting the new version", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (u: unknown, init?: RequestInit) => {
      const urlStr = String(u);
      calls.push({ url: urlStr, init });
      if (urlStr.endsWith("/feedback")) {
        return {
          ok: true,
          json: async () => ({
            items: [],
            proposals: [
              {
                id: "pr1",
                section_ref: "outcomes",
                old_text: "قديم",
                new_text: "جديد",
                reason: "ملاحظة",
                decision: "pending",
                applied_version_no: null,
              },
            ],
          }),
        };
      }
      // apply
      return { ok: true, json: async () => ({ result: { appliedVersionNo: 3 } }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<CenterFeedbackPanel programId="p1" />);

    expect(screen.getByRole("note")).toHaveTextContent("قبل/بعد");
    expect(await screen.findByText("قديم")).toBeInTheDocument();
    expect(screen.getByText("جديد")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "تطبيق" }));

    expect(await screen.findByText(/أُنشئت نسخة 3/)).toBeInTheDocument();
    const applyCall = calls.find((c) => c.url.endsWith("/proposals/pr1"))!;
    expect(JSON.parse(applyCall.init!.body as string).action).toBe("apply");
  });
});
