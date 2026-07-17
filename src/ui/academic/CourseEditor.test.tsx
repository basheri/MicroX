import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CourseEditor } from "@/ui/academic/CourseEditor";
import { setActorName } from "@/lib/actor";

describe("CourseEditor (SC-13 / BR-001/003)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("lists courses, shows BR structure issues, and posts a new course", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (method === "POST")
        return { ok: true, status: 201, json: async () => ({ courseId: "c9" }) };
      return {
        ok: true,
        json: async () => ({
          courses: [{ id: "c1", title: "مقرر أول", credit_hours: 3, actual_hours: 45 }],
          issues: [
            {
              ruleCode: "BR-001",
              message: "يجب أن يحتوي البرنامج على 2 إلى 6 مقررات (القاعدة BR-001).",
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<CourseEditor programId="p1" />);

    expect(await screen.findByText(/مقرر أول/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("BR-001");

    await userEvent.type(screen.getByLabelText("اسم المقرر"), "مقرر جديد");
    await userEvent.click(screen.getByRole("button", { name: "إضافة مقرر" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.title).toBe("مقرر جديد");
      expect(body.creditHours).toBe(3);
    });
  });
});
