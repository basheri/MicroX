import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricsPanel } from "@/ui/dashboard/MetricsPanel";

describe("MetricsPanel (SC-03 / EP-20)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders counts by stage/approval as accessible tables and an Excel export link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          metrics: {
            programsByStage: [
              { key: "new", count: 2 },
              { key: "export", count: 1 },
            ],
            programsByApproval: [{ key: "not_approved", count: 3 }],
            publishedCount: 1,
            totalActivePrograms: 3,
            generationJobsByStatus: [],
            unresolvedFeedback: 0,
            exportPackagesByStatus: [],
            blockingChecks: 0,
            auditLast24h: 5,
          },
        }),
      })) as unknown as typeof fetch,
    );

    render(<MetricsPanel />);

    expect(await screen.findByText("البرامج حسب المرحلة")).toBeInTheDocument();
    expect(screen.getByText("البرامج حسب الاعتماد")).toBeInTheDocument();
    // Excel export link points at the download route.
    const link = screen.getByRole("link", { name: "تصدير Excel" });
    expect(link).toHaveAttribute("href", "/api/dashboard/export");
  });
});
