import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketAnalysis } from "@/ui/market/MarketAnalysis";
import { setActorName } from "@/lib/actor";

const market = {
  analysis: { id: "a1", summary: "سوق نشط", feasibility_rating: "high", is_approved: false },
  skills: [{ skill: "تحليل البيانات", demand_level: "high" }],
  sources: [{ url: "https://example.gov.sa", title: "تقرير", reliability: "high" }],
};

describe("MarketAnalysis (SC-08/09)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("renders summary, skills, sources, feasibility and approves", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (method === "POST") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ market }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<MarketAnalysis programId="p1" />);

    expect(await screen.findByText("سوق نشط")).toBeInTheDocument();
    expect(screen.getByText("تحليل البيانات — high")).toBeInTheDocument();
    expect(screen.getByText(/مرتفعة/)).toBeInTheDocument(); // feasibility label

    await userEvent.click(screen.getByRole("button", { name: "اعتماد التحليل" }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(String(post![0])).toBe("/api/market/a1/approve");
    });
  });
});
