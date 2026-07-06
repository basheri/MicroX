import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesPanel } from "@/ui/templates/TemplatesPanel";
import { setActorName } from "@/lib/actor";

describe("TemplatesPanel (SC-25 / EP-15)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows the placeholder banner and reports the fidelity result", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 201,
      json: async () => ({
        result: { docId: "d1", fidelityPassed: true, missingRequired: [], isPlaceholder: true },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<TemplatesPanel programId="p1" versionId="v1" />);

    // Placeholder / no-HTML notice is shown.
    expect(screen.getByRole("note")).toHaveTextContent("لا تحويل HTML إلى Word");

    await userEvent.click(screen.getByRole("button", { name: "توليد الوثيقة" }));

    expect(await screen.findByText(/ناجحة ✓/)).toBeInTheDocument();
    const post = fetchMock.mock.calls[0]!;
    expect(String(post[0])).toBe("/api/programs/p1/document");
    expect(JSON.parse((post[1] as RequestInit).body as string).versionId).toBe("v1");
  });
});
