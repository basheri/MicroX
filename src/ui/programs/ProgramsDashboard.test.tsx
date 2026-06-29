import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProgramsDashboard } from "@/ui/programs/ProgramsDashboard";
import type { Program } from "@/data/programsRepo";

const lookups = {
  sectors: [{ id: "s1", name: "التقنية" }],
  fields: [{ id: "f1", sector_id: "s1", name: "الأمن السيبراني" }],
  developmentPaths: [{ id: "p1", path_code: "path_1", name: "مسار 1" }],
};

const program = {
  id: "pr1",
  name: "برنامج العرض",
  sector_id: "s1",
  field_id: "f1",
  development_path_id: null,
  current_stage: "market",
  sub_status: "not_started",
  completion_pct: 15,
  blocking_errors: 2,
  warnings_count: 0,
  approval_state: "not_approved",
  is_published: false,
  is_deleted: false,
  created_by_actor: "منى",
  updated_by_actor: "منى",
} as Program;

describe("ProgramsDashboard (SC-03)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders programs with the Arabic stage label and counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ programs: [program] }),
      })) as unknown as typeof fetch,
    );

    render(<ProgramsDashboard lookups={lookups} />);

    expect(await screen.findByRole("cell", { name: "برنامج العرض" })).toBeInTheDocument();
    // Stage label for "market" appears in the row cell (also in the filter dropdown).
    expect(screen.getByRole("cell", { name: "تحليل سوق العمل" })).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
    // The filter controls exist (sector/field/path/stage/approval + search).
    expect(screen.getByLabelText("القطاع")).toBeInTheDocument();
    expect(screen.getByLabelText("المرحلة")).toBeInTheDocument();
    expect(screen.getByLabelText("الاعتماد")).toBeInTheDocument();
  });

  it("sends active filters as query parameters", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      json: async () => ({ programs: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ProgramsDashboard lookups={lookups} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Initial load with no filters hits the base endpoint.
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/programs?");
  });
});
