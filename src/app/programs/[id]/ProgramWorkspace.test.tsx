import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgramWorkspace from "@/app/programs/[id]/page";
import { setActorName } from "@/lib/actor";

// The workspace hosts real panels that self-fetch on mount; stub fetch so they mount
// without a server. We verify the NAVIGATION (tabs render + switch to the real panels).
describe("ProgramWorkspace — program hub navigation", () => {
  beforeEach(() => {
    setActorName("منى");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "{}",
      })) as unknown as typeof fetch,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the tab list and lands on the sources tab", () => {
    render(<ProgramWorkspace params={{ id: "p1" }} />);
    expect(screen.getByRole("tablist", { name: "أقسام البرنامج" })).toBeInTheDocument();
    // Every major section is reachable as a tab.
    for (const label of [
      "المصادر",
      "تحليل السوق",
      "الجودة",
      "التوافق",
      "النسخ والنشر",
      "التصدير",
    ]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("switches tabs to render the real compliance and versions panels", async () => {
    render(<ProgramWorkspace params={{ id: "p1" }} />);

    await userEvent.click(screen.getByRole("tab", { name: "التوافق" }));
    expect(screen.getByRole("heading", { name: /التوافق وبوابة التصدير/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "النسخ والنشر" }));
    expect(screen.getByRole("heading", { name: /النسخ والنشر/ })).toBeInTheDocument();
  });

  it("the export tab asks to prepare a template before exporting (V-01/V-06 placeholder)", async () => {
    render(<ProgramWorkspace params={{ id: "p1" }} />);
    await userEvent.click(screen.getByRole("tab", { name: "التصدير" }));
    expect(screen.getByRole("button", { name: "تجهيز القالب" })).toBeInTheDocument();
  });
});
