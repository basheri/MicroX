import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPackagePanel } from "@/ui/export/ExportPackagePanel";
import { setActorName } from "@/lib/actor";

describe("ExportPackagePanel (SC-23 / EP-21)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("builds a package and renders the index (artifacts + requirement status)", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 201,
      json: async () => ({
        result: {
          packageId: "pkg1",
          decision: "clear",
          fidelityPassed: true,
          manifest: [
            {
              name: "program-document.docx",
              type: "word_document",
              requirement: "الوثيقة الرسمية",
              status: "pass",
            },
            {
              name: "index.md",
              type: "index",
              requirement: "فهرس الحزمة",
              status: "present",
            },
          ],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ExportPackagePanel programId="p1" templateVersionId="v1" />);

    expect(screen.getByRole("note")).toHaveTextContent("لا تُنشأ رسائل أو خطابات");
    await userEvent.click(screen.getByRole("button", { name: "بناء الحزمة" }));

    expect(await screen.findByText(/تم بناء الحزمة/)).toBeInTheDocument();
    expect(screen.getByText("الوثيقة الرسمية")).toBeInTheDocument();
    expect(screen.getByText("program-document.docx")).toBeInTheDocument();
  });
});
