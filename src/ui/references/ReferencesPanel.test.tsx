import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReferencesPanel } from "@/ui/references/ReferencesPanel";
import { setActorName } from "@/lib/actor";

describe("ReferencesPanel (SC-17 / TC-10)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows verified and flagged references in AR/EN lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          references: [
            {
              id: "r1",
              citation: "مرجع موثّق",
              language: "ar",
              verified: true,
              verification_note: null,
            },
            {
              id: "r2",
              citation: "Fabricated ref",
              language: "en",
              verified: false,
              verification_note: "المرجع غير موجود (مُختلَق).",
            },
          ],
        }),
      })) as unknown as typeof fetch,
    );

    render(<ReferencesPanel programId="p1" />);

    expect(await screen.findByText("مرجع موثّق")).toBeInTheDocument();
    expect(screen.getByText("موثّق ✓")).toBeInTheDocument();
    // The fabricated reference is shown as rejected/flagged, not silently dropped.
    expect(screen.getByRole("alert")).toHaveTextContent("غير موثّق — مرفوض");
    expect(screen.getByText("المراجع العربية")).toBeInTheDocument();
    expect(screen.getByText("المراجع الإنجليزية")).toBeInTheDocument();
  });
});
