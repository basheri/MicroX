import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlignmentGaps } from "@/ui/academic/AlignmentGaps";

describe("AlignmentGaps (SC-20 / TC-06)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists uncovered outcomes and content without an outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          matrix: [],
          gaps: {
            uncoveredPLOs: [{ id: "p1", statement: "مخرج غير مغطى" }],
            uncoveredCLOs: [],
            contentWithoutOutcome: [{ id: "u1", title: "وحدة بلا مخرج" }],
          },
        }),
      })) as unknown as typeof fetch,
    );

    render(<AlignmentGaps programId="p1" />);

    expect(await screen.findByText("مخرج غير مغطى")).toBeInTheDocument();
    expect(screen.getByText("وحدة بلا مخرج")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows a clear message when there are no gaps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          matrix: [],
          gaps: { uncoveredPLOs: [], uncoveredCLOs: [], contentWithoutOutcome: [] },
        }),
      })) as unknown as typeof fetch,
    );
    render(<AlignmentGaps programId="p1" />);
    expect(await screen.findByText(/لا توجد فجوات/)).toBeInTheDocument();
  });
});
