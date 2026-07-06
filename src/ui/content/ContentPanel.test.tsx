import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContentPanel } from "@/ui/content/ContentPanel";
import { setActorName } from "@/lib/actor";

describe("ContentPanel (SC-16 / BR-009)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("labels activities formative-only and posts a formative activity", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (method === "POST")
        return { ok: true, json: async () => ({ activityId: "a2", isFormative: true }) };
      return {
        ok: true,
        json: async () => ({
          resources: [],
          activities: [{ id: "a1", title: "نشاط", is_formative: true }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ContentPanel lessonId="l1" />);

    // The BR-009 notice and the formative label are shown.
    expect(await screen.findByRole("note")).toHaveTextContent("لا تُحتسب في تحديد النجاح");
    expect(screen.getByText(/تكويني \(لا يُحتسب في النجاح\)/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("عنوان النشاط"), "نشاط جديد");
    await userEvent.click(screen.getByRole("button", { name: "إضافة نشاط تكويني" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.kind).toBe("activity");
      expect(body.title).toBe("نشاط جديد");
    });
  });
});
