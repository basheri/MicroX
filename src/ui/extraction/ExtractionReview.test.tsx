import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExtractionReview } from "@/ui/extraction/ExtractionReview";
import { setActorName } from "@/lib/actor";

const blocks = [
  {
    id: "b1",
    page_no: 1,
    bbox: null,
    content: "نص واضح",
    source_class: "ocr",
    confidence: 0.95,
    review_status: null,
    corrected_content: null,
    usable: true,
    needs_review: false,
  },
  {
    id: "b2",
    page_no: 1,
    bbox: null,
    content: "نص ضبابي",
    source_class: "ocr",
    confidence: 0.4,
    review_status: null,
    corrected_content: null,
    usable: false,
    needs_review: true,
  },
];

describe("ExtractionReview (SC-07 / TC-09)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("flags low-confidence blocks as blocked and posts an approval", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      json: async () => ({ blocks }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ExtractionReview fileId="f1" />);

    expect(await screen.findByText("نص ضبابي")).toBeInTheDocument();
    // Only the low-confidence block shows the blocked status + actions.
    expect(screen.getByRole("status")).toHaveTextContent("محجوب حتى المراجعة");

    await userEvent.click(screen.getByRole("button", { name: "اعتماد" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(post).toBeTruthy();
      expect(String(post![0])).toBe("/api/extraction/b2/review");
      expect(JSON.parse((post![1] as RequestInit).body as string).status).toBe("approved");
    });
  });
});
