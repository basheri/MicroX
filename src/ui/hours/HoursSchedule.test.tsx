import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoursSchedule } from "@/ui/hours/HoursSchedule";
import { setActorName } from "@/lib/actor";

describe("HoursSchedule (SC-15 / BR-005)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows live totals and a BR-005 block message when weekly load exceeds 15", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (method === "POST") {
        return {
          ok: false,
          status: 422,
          json: async () => ({ error: "الحمل الأسبوعي (22.5 ساعة فعلية) يتجاوز الحد الأقصى 15." }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          totalCredit: 3,
          totalActual: 45,
          weeks: null,
          weeklyLoad: null,
          issues: [],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<HoursSchedule programId="p1" />);

    expect(await screen.findByText(/45/)).toBeInTheDocument(); // total actual hours

    await userEvent.type(screen.getByLabelText("عدد الأسابيع"), "2");
    await userEvent.click(screen.getByRole("button", { name: "حفظ الجدولة" }));

    expect(await screen.findByRole("status")).toHaveTextContent("يتجاوز الحد الأقصى");
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(JSON.parse((post![1] as RequestInit).body as string).weeks).toBe(2);
    });
  });
});
