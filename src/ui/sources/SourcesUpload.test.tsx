import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourcesUpload } from "@/ui/sources/SourcesUpload";
import { setActorName } from "@/lib/actor";

describe("SourcesUpload (SC-06)", () => {
  beforeEach(() => setActorName("منى"));
  afterEach(() => vi.restoreAllMocks());

  it("shows the redaction notice and restricts the picker to PDF/DOCX/XLSX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ files: [] }),
      })) as unknown as typeof fetch,
    );
    render(<SourcesUpload programId="p1" />);

    expect(screen.getByRole("note")).toHaveTextContent("يُزال تلقائيًا");
    expect(screen.getByLabelText("ملف")).toHaveAttribute("accept", ".pdf,.docx,.xlsx");
  });

  it("posts the chosen file as multipart with the actor header", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 201,
      json: async () => ({ files: [], source: { fileId: "f1" } }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SourcesUpload programId="p1" />);
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "doc.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("ملف"), file);
    await userEvent.click(screen.getByRole("button", { name: "رفع" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
      expect(post).toBeTruthy();
      expect(String(post![0])).toBe("/api/programs/p1/sources");
      const init = post![1] as RequestInit;
      expect((init.headers as Record<string, string>)["x-actor-name"]).toBe("منى");
      expect(init.body).toBeInstanceOf(FormData);
    });
  });
});
