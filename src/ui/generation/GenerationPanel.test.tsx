import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerationPanel } from "@/ui/generation/GenerationPanel";
import { setActorName } from "@/lib/actor";

const sections = [
  { id: "s1", section_key: "outcomes", status: "previewed", is_pinned: false },
  { id: "s2", section_key: "courses", status: "applied", is_pinned: false },
];

describe("GenerationPanel (SC-11 / EP-09)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows previews with an explicit apply action, and runs read-only impact analysis", async () => {
    const fetchMock = vi.fn(async (urlArg: unknown, init?: unknown) => {
      const u = String(urlArg);
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (u.endsWith("/impact")) {
        return {
          ok: true,
          json: async () => ({
            affectedKeys: ["outcomes", "courses", "questions"],
            applied: false,
          }),
        };
      }
      if (method === "POST") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ sections }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<GenerationPanel programId="p1" />);

    // Preview section offers an explicit apply; the applied one does not.
    expect(await screen.findByText("معاينة")).toBeInTheDocument();
    expect(screen.getByText("مُطبّق")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تطبيق بعد المعاينة" })).toBeInTheDocument();

    // Impact analysis lists affected sections (no apply call).
    await userEvent.click(screen.getAllByRole("button", { name: "تحليل الأثر" })[0]!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("الأقسام المتأثرة"));
    const impactCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/impact"));
    expect(impactCall).toBeTruthy();
  });
});
